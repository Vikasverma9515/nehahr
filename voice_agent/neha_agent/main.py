"""Neha voice agent worker.

    python -m neha_agent.main dev      # local development, hot reload
    python -m neha_agent.main start    # production
    python -m neha_agent.main console  # talk to it in the terminal (needs NEHA_CONSOLE_CONTEXT)

The backend dispatches this agent (name: LIVEKIT_AGENT_NAME, default "neha")
into a room with metadata saying which call to run and over which channel:

    phone       the agent dials the candidate through LiveKit SIP
    playground  a recruiter tests Neha from the dashboard
    room        a candidate joins our own interview room (optionally with a Tavus face)
    meet        the Meet bot bridges a Google Meet into this room
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone

from livekit import api, rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    cli,
    room_io,
)
from livekit.agents.voice.amd import AMD, AMDCategory

from . import prompts
from .agents import CallState, build_agent
from .backend import BackendClient
from .config import settings
from .pipeline import build_llm, build_stt, build_tts, build_vad, describe, turn_handling
from .telemetry import LatencyTracker

log = logging.getLogger("neha.worker")

STATE_TOPIC = "neha.state"      # live snapshot for the playground
CONTROL_TOPIC = "neha.control"  # recruiter pause / resume
AVATAR_CHANNELS = {"room", "meet", "playground"}

def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = build_vad()


# Explicit dispatch: the backend sends this agent into rooms by name.
os.environ.setdefault("LIVEKIT_AGENT_NAME", settings.livekit_agent_name)
server = AgentServer(setup_fnc=prewarm)


def _noise_cancellation(phone: bool):
    """LiveKit Cloud noise cancellation when available (no-op when self-hosted)."""
    try:
        from livekit.plugins import noise_cancellation

        return noise_cancellation.BVCTelephony() if phone else noise_cancellation.BVC()
    except Exception:
        return None


def transcript_from_history(session: AgentSession) -> list[dict]:
    items = []
    for item in session.history.items:
        if getattr(item, "type", None) != "message" or item.role not in ("user", "assistant"):
            continue
        text = (item.text_content or "").strip()
        if not text:
            continue
        items.append({
            "speaker": "neha" if item.role == "assistant" else "candidate",
            "text": text,
            "timestamp": datetime.fromtimestamp(item.created_at, timezone.utc).isoformat(),
            "interrupted": bool(item.interrupted),
        })
    return items


async def _load_context(backend: BackendClient, meta: dict) -> dict:
    # Console / local testing can pass a full context instead of a call id.
    if meta.get("context_override"):
        return meta["context_override"]
    return await backend.call_context(meta["call_id"])


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    meta = json.loads(ctx.job.metadata or "{}")
    if not meta and os.environ.get("NEHA_CONSOLE_CONTEXT"):
        meta = {"call_id": "console", "channel": "playground",
                "context_override": json.load(open(os.environ["NEHA_CONSOLE_CONTEXT"]))}
    channel = meta.get("channel", "phone")
    call_id = meta.get("call_id", "unknown")
    pipeline_spec = meta.get("pipeline") or {}
    ctx.log_context_fields = {"call_id": call_id, "channel": channel}

    backend = BackendClient()
    if channel == "inbound":
        # A SIP dispatch rule sent us here: the caller is already in the room.
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        caller = await ctx.wait_for_participant(kind=rtc.ParticipantKind.PARTICIPANT_KIND_SIP)
        call_ctx = await backend.inbound(
            caller.attributes.get("sip.phoneNumber", ""),
            caller.attributes.get("sip.trunkPhoneNumber"),
            ctx.room.name,
        )
        call_id = call_ctx["call_id"]
        channel = "phone"
        meta = {**meta, "inbound_identity": caller.identity}
    else:
        call_ctx = await _load_context(backend, meta)
    call_ctx.setdefault("call", {}).setdefault("channel", channel)
    call_type = call_ctx["call"].get("call_type", meta.get("call_type", "screening"))
    is_phone = channel == "phone"

    state = CallState(call_id=call_id, call_type=call_type, channel=channel, context=call_ctx)
    tracker = LatencyTracker()

    if not meta.get("inbound_identity"):
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        stt=build_stt(pipeline_spec.get("stt"), phone=is_phone),
        llm=build_llm(pipeline_spec.get("llm")),
        tts=build_tts(pipeline_spec.get("tts")),
        vad=ctx.proc.userdata["vad"],
        turn_handling=turn_handling(),
        userdata=state,
        max_tool_steps=4,
        user_away_timeout=12.0,
    )

    # ── Live state for the playground / room UI ──────────────────────────
    def publish_state(extra: dict | None = None) -> None:
        payload = {
            "call_id": call_id,
            "call_type": call_type,
            "extracted": state.extracted,
            "confirmed_slot_id": state.confirmed_slot_id,
            "latency": tracker.rows()[-20:],
            "latency_summary": tracker.summary(),
            **(extra or {}),
        }
        try:
            asyncio.get_running_loop().create_task(
                ctx.room.local_participant.publish_data(
                    json.dumps(payload, default=str), reliable=True, topic=STATE_TOPIC
                )
            )
        except Exception as e:  # never break the call over UI telemetry
            log.debug("publish_state failed: %s", e)

    state.on_change = publish_state

    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent) -> None:
        if tracker.add(ev.metrics):
            publish_state()

    @session.on("agent_state_changed")
    def _on_agent_state(ev) -> None:
        publish_state({"agent_state": ev.new_state})

    # ── Recruiter take-over (room / playground) ──────────────────────────
    paused = {"on": False}

    def _on_data(packet: rtc.DataPacket) -> None:
        if packet.topic != CONTROL_TOPIC or not packet.participant:
            return
        if packet.participant.attributes.get("role") not in ("recruiter", "tester"):
            return
        try:
            action = json.loads(packet.data.decode()).get("action")
        except Exception:
            return
        if action == "pause" and not paused["on"]:
            paused["on"] = True
            session.interrupt()
            session.input.set_audio_enabled(False)
            publish_state({"paused": True})
        elif action == "resume" and paused["on"]:
            paused["on"] = False
            session.input.set_audio_enabled(True)
            publish_state({"paused": False})
            session.generate_reply(instructions=(
                "A human recruiter just spoke with the candidate and has handed back to you. "
                "Briefly acknowledge it and continue where you left off."))

    ctx.room.on("data_received", _on_data)

    away_count = {"n": 0}

    @session.on("user_state_changed")
    def _on_user_state(ev) -> None:
        if ev.new_state != "away" or state.ended_naturally or paused["on"]:
            return
        away_count["n"] += 1
        if away_count["n"] == 1:
            session.generate_reply(instructions="The candidate has gone quiet. Briefly check if they're still there.")
        else:
            session.generate_reply(instructions="Still no answer. Say you'll try again later, say goodbye, and call end_call with reason 'other'.")

    # ── End-of-call report ───────────────────────────────────────────────
    started = time.time()

    async def send_report(reason: str) -> None:
        report = {
            "transcript": transcript_from_history(session),
            "extracted": state.extracted,
            "ended_naturally": state.ended_naturally,
            "confirmed_slot_id": state.confirmed_slot_id,
            "latency_metrics": tracker.rows(),
            "pipeline": {**describe(pipeline_spec.get("stt"), pipeline_spec.get("llm"), pipeline_spec.get("tts")),
                         "avatar": bool(pipeline_spec.get("avatar")), "latency": tracker.summary()},
            "end_reason": state.end_reason or reason,
            "duration_seconds": int(time.time() - started),
        }
        if call_id in ("console", "unknown"):
            log.info("report: %s", json.dumps(report, default=str)[:2000])
        else:
            try:
                await backend.complete(call_id, report)
            except Exception as e:
                log.error("failed to send call report for %s: %s", call_id, e)
        await backend.aclose()

    ctx.add_shutdown_callback(send_report)

    # ── Face (Tavus) for video channels ──────────────────────────────────
    want_avatar = bool(pipeline_spec.get("avatar")) or channel in ("room", "meet")
    if want_avatar and channel in AVATAR_CHANNELS and settings.tavus_api_key and settings.tavus_face_id:
        try:
            from livekit.plugins import tavus

            kwargs = {"face_id": settings.tavus_face_id, "api_key": settings.tavus_api_key,
                      "avatar_participant_name": "Neha"}
            if settings.tavus_pal_id:
                kwargs["pal_id"] = settings.tavus_pal_id
            avatar = tavus.AvatarSession(**kwargs)
            await avatar.start(session, room=ctx.room)
        except Exception as e:
            log.warning("Tavus avatar unavailable, continuing voice-only: %s", e)

    agent = build_agent(call_ctx)
    room_options = room_io.RoomOptions(
        audio_input=room_io.AudioInputOptions(noise_cancellation=_noise_cancellation(is_phone)),
        close_on_disconnect=True,
        delete_room_on_close=is_phone,
    )

    if channel == "room" and (call_ctx.get("candidate") or {}).get("id"):
        # Always listen to the candidate, never to a recruiter who joins to watch.
        room_options.participant_identity = f"candidate-{call_ctx['candidate']['id']}"

    if meta.get("inbound_identity"):
        room_options.participant_identity = meta["inbound_identity"]
        await session.start(agent=agent, room=ctx.room, room_options=room_options)
        session.say(prompts.greeting(call_ctx), allow_interruptions=True)
    elif is_phone:
        await _run_phone(ctx, session, agent, room_options, backend, state, meta, call_ctx)
    else:
        await session.start(agent=agent, room=ctx.room, room_options=room_options)
        await backend.set_status(call_id, "in_progress")
        session.say(prompts.greeting(call_ctx), allow_interruptions=True)

    _arm_call_timer(session, state)


async def _run_phone(ctx, session, agent, room_options, backend, state, meta, call_ctx) -> None:
    """Dial the candidate, detect voicemail, then talk."""
    call_id = state.call_id
    identity = f"sip-{call_id}"
    room_options.participant_identity = identity
    await session.start(agent=agent, room=ctx.room, room_options=room_options)

    await backend.set_status(call_id, "ringing")
    try:
        async with AMD(session, participant_identity=identity) as detector:
            info = await ctx.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=meta.get("sip_trunk_id"),
                sip_call_to=meta["phone_number"],
                participant_identity=identity,
                participant_name=(call_ctx.get("candidate") or {}).get("name") or "Candidate",
                wait_until_answered=True,
                krisp_enabled=True,
            ))
            await backend.set_status(call_id, "in_progress", sip_call_id=getattr(info, "sip_call_id", None))
            verdict = await detector.execute()
    except api.ServerError as e:
        code = getattr(e, "sip_status_code", None)
        status = {486: "busy", 600: "busy", 480: "no_answer", 408: "no_answer",
                  487: "no_answer", 603: "no_answer"}.get(code, "failed")
        log.info("dial failed for %s: %s (sip %s)", call_id, e.message, code)
        state.end_reason = f"dial_{status}"
        await backend.set_status(call_id, status, end_reason=f"sip {code}: {e.message}")
        ctx.shutdown(reason=state.end_reason)
        return

    if verdict.category in (AMDCategory.MACHINE_VM,):
        await backend.set_status(call_id, "voicemail", answered_by="machine")
        name = ((call_ctx.get("candidate") or {}).get("name") or "").split(" ")[0]
        company = (call_ctx.get("company") or {}).get("name") or "our company"
        handle = session.say(
            f"Hi {name}, this is Neha from {company}'s recruiting team, calling about your application. "
            "I'll try you again a little later. Talk soon!",
            allow_interruptions=False,
        )
        await handle.wait_for_playout()
        state.end_reason = "voicemail"
        ctx.shutdown(reason="voicemail")
        return
    if verdict.category in (AMDCategory.MACHINE_IVR, AMDCategory.MACHINE_UNAVAILABLE):
        await backend.set_status(call_id, "voicemail", answered_by="ivr")
        state.end_reason = verdict.category.value
        ctx.shutdown(reason=verdict.category.value)
        return

    await backend.set_status(call_id, "in_progress", answered_by="human")
    session.say(prompts.greeting(call_ctx), allow_interruptions=True)


def _arm_call_timer(session: AgentSession, state: CallState) -> None:
    """Ask Neha to wrap up shortly before the hard limit."""
    limit = settings.max_call_seconds

    async def _wrap_up() -> None:
        await asyncio.sleep(max(30, limit - 45))
        if not state.ended_naturally:
            session.generate_reply(
                instructions="We're almost out of time. Wrap up in one or two sentences, "
                "thank the candidate, and call end_call."
            )

    asyncio.get_running_loop().create_task(_wrap_up())


if __name__ == "__main__":
    cli.run_app(server)
