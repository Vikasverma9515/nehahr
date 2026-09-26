"""Start calls on the LiveKit voice agent.

Every conversation is a LiveKit room with the Neha agent dispatched into it.
The job metadata tells the agent what to do:

    {"call_id": "...", "call_type": "screening", "candidate_id": "...",
     "channel": "phone" | "playground" | "room" | "meet",
     "phone_number": "+91...",           # phone only — the agent dials it over SIP
     "pipeline": {"stt": ..., "llm": ..., "tts": ..., "avatar": false}}

For browser channels we also hand back a participant token so the user can
join the same room.
"""

from __future__ import annotations

import json
import uuid

from livekit import api

from app.config import settings
from app.services import db


class LiveKitNotConfigured(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret)


def _require_config() -> None:
    if not is_configured():
        raise LiveKitNotConfigured(
            "LiveKit is not configured: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET"
        )


def _client() -> api.LiveKitAPI:
    return api.LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)


def participant_token(room: str, identity: str, name: str, *, ttl_minutes: int = 60,
                      can_publish: bool = True, attributes: dict[str, str] | None = None) -> str:
    """Join token for a human in a room."""
    _require_config()
    from datetime import timedelta

    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(name)
        .with_ttl(timedelta(minutes=ttl_minutes))
        .with_grants(api.VideoGrants(
            room_join=True, room=room, can_publish=can_publish,
            can_subscribe=True, can_publish_data=True,
        ))
    )
    if attributes:
        token = token.with_attributes(attributes)
    return token.to_jwt()


async def dispatch_agent(room: str, metadata: dict) -> str:
    """Create the room (if needed) and send the Neha agent into it."""
    _require_config()
    lk = _client()
    try:
        await lk.room.create_room(api.CreateRoomRequest(
            name=room,
            empty_timeout=120,        # close 2 min after everyone leaves
            departure_timeout=20,
            max_participants=6,
        ))
        dispatch = await lk.agent_dispatch.create_dispatch(api.CreateAgentDispatchRequest(
            agent_name=settings.livekit_agent_name,
            room=room,
            metadata=json.dumps(metadata),
        ))
        return dispatch.id
    finally:
        await lk.aclose()


async def end_room(room: str) -> None:
    if not is_configured():
        return
    lk = _client()
    try:
        await lk.room.delete_room(api.DeleteRoomRequest(room=room))
    except Exception:
        pass
    finally:
        await lk.aclose()


def _room_name(prefix: str, call_id: str) -> str:
    return f"{prefix}-{call_id}"


async def start_phone_call(candidate_id: str, call_type: str) -> dict:
    """Outbound phone call through LiveKit SIP. The agent dials once it's in the room."""
    _require_config()
    if not settings.livekit_sip_trunk_id:
        raise LiveKitNotConfigured("LIVEKIT_SIP_TRUNK_ID is not set")

    from app.services.phone import to_e164

    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
    to_number = to_e164(candidate["phone"])

    call = db.create_call_record(candidate_id=candidate_id, call_type=call_type, to_number=to_number)
    room = _room_name("call", call["id"])
    db.update_call_status(call["id"], "queued", runtime="livekit", channel="phone", room_name=room)

    await dispatch_agent(room, {
        "call_id": call["id"],
        "call_type": call_type,
        "candidate_id": candidate_id,
        "channel": "phone",
        "phone_number": to_number,
        "sip_trunk_id": settings.livekit_sip_trunk_id,
    })
    return {"call_id": call["id"], "room": room, "to_number": to_number, "status": "queued"}


async def start_browser_session(
    *,
    candidate_id: str,
    call_type: str,
    channel: str,
    user_identity: str,
    user_name: str,
    pipeline: dict | None = None,
    is_test: bool = False,
    extra_metadata: dict | None = None,
) -> dict:
    """A browser conversation (playground or interview room): dispatch + user token."""
    _require_config()
    call = db.create_call_record(candidate_id=candidate_id, call_type=call_type)
    room = _room_name(channel, call["id"])
    db.update_call_status(
        call["id"], "queued", runtime="livekit", channel=channel, room_name=room,
        is_test=is_test, pipeline=pipeline or None,
    )
    await dispatch_agent(room, {
        "call_id": call["id"],
        "call_type": call_type,
        "candidate_id": candidate_id,
        "channel": channel,
        "pipeline": pipeline or {},
        **(extra_metadata or {}),
    })
    token = participant_token(
        room, identity=user_identity or f"user-{uuid.uuid4().hex[:8]}", name=user_name,
        attributes={"role": "candidate" if channel == "room" else "tester"},
    )
    return {
        "call_id": call["id"],
        "room": room,
        "url": settings.livekit_url,
        "token": token,
    }


def recording_configured() -> bool:
    return bool(settings.egress_s3_bucket and settings.egress_s3_access_key and settings.egress_s3_secret)


async def start_room_recording(room: str, call_id: str) -> str | None:
    """Record the room (speaker layout, MP4) to S3-compatible storage.

    Works with AWS S3, Cloudflare R2 or Supabase Storage's S3 endpoint. The
    file URL is saved on the call so the dashboard can play it back.
    """
    if not (is_configured() and recording_configured()):
        return None
    path = f"interviews/{call_id}.mp4"
    lk = _client()
    try:
        await lk.egress.start_room_composite_egress(api.RoomCompositeEgressRequest(
            room_name=room,
            layout="speaker",
            file_outputs=[api.EncodedFileOutput(
                filepath=path,
                s3=api.S3Upload(
                    bucket=settings.egress_s3_bucket,
                    region=settings.egress_s3_region,
                    access_key=settings.egress_s3_access_key,
                    secret=settings.egress_s3_secret,
                    endpoint=settings.egress_s3_endpoint,
                    force_path_style=bool(settings.egress_s3_endpoint),
                ),
            )],
        ))
    except Exception as e:
        print(f"[EGRESS] Could not start recording for {room}: {e}")
        return None
    finally:
        await lk.aclose()
    url = f"{settings.egress_public_base_url.rstrip('/')}/{path}" if settings.egress_public_base_url else path
    db.update_call_status(call_id, "in_progress", recording_url=url)
    return url
