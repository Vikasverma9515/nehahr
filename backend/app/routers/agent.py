"""API for the LiveKit voice agent and the browser playground.

Internal routes (``/api/agent/calls/...``) are called by the voice agent
worker with ``X-Internal-Key``. The playground route is called by the
dashboard on behalf of a signed-in recruiter.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.security import CurrentUser, require_user
from app.services import db, livekit_service
from app.services.call_outcome import CallOutcome, summarize_transcript


async def require_service(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if not user.is_service:
        raise HTTPException(status_code=403, detail="Internal endpoint")
    return user


internal = APIRouter(dependencies=[Depends(require_service)])
router = APIRouter()


# ── Context the agent needs before it speaks ─────────────────────────────

@internal.get("/calls/{call_id}/context")
async def call_context(call_id: str):
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    candidate = db.get_candidate(call["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    outcome = CallOutcome(call_id, call["call_type"], call["candidate_id"])
    context = outcome._build_call_context()

    job = candidate.get("jobs") or {}
    org_settings: dict = {}
    if call.get("org_id"):
        try:
            org = db.get_supabase().table("organizations").select("name, settings").eq(
                "id", call["org_id"]).single().execute()
            org_settings = {"company_name": org.data.get("name"), **(org.data.get("settings") or {})}
        except Exception:
            pass

    from app.config import settings
    screening = None
    if candidate.get("job_id"):
        try:
            res = db.get_supabase().table("jobs").select("screening_config").eq(
                "id", candidate["job_id"]).single().execute()
            screening = (res.data or {}).get("screening_config")
        except Exception:
            screening = None  # column added in a later migration

    return {
        "call": {
            "id": call_id,
            "call_type": call["call_type"],
            "channel": call.get("channel", "phone"),
            "is_test": call.get("is_test", False),
        },
        "candidate": {
            "id": candidate["id"],
            "name": candidate.get("name"),
            "phone": candidate.get("phone"),
            "email": candidate.get("email"),
            "current_location": candidate.get("current_location"),
            "employment_status": candidate.get("employment_status"),
            "preferred_language": candidate.get("preferred_language"),
        },
        "job": {
            "title": job.get("title"),
            "role_type": job.get("role_type"),
            "required_skills": job.get("required_skills"),
            "work_model": job.get("work_model"),
        },
        "company": {
            "name": org_settings.get("company_name") or settings.hr_company_name,
        },
        "screening_config": screening,
        "context": context,
    }


# ── Status updates while the call is live ────────────────────────────────

class StatusUpdate(BaseModel):
    status: str
    answered_by: str | None = None
    sip_call_id: str | None = None
    end_reason: str | None = None


@internal.post("/calls/{call_id}/status")
async def call_status(call_id: str, body: StatusUpdate):
    extra = {k: v for k, v in body.model_dump().items() if k != "status" and v is not None}
    if body.status == "in_progress":
        extra["started_at"] = datetime.now(timezone.utc).isoformat()
    db.update_call_status(call_id, body.status, **extra)

    # Unreachable candidates go back to a state HR can retry from.
    if body.status in ("no_answer", "busy", "failed", "voicemail"):
        call = db.get_call(call_id) or {}
        if not call.get("is_test"):
            _reset_unreachable(call, body.status)
    return {"ok": True}


def _reset_unreachable(call: dict, status: str) -> None:
    cid, ctype = call.get("candidate_id"), call.get("call_type")
    supabase = db.get_supabase()
    if ctype == "screening" and cid:
        supabase.table("candidates").update({
            "stage": "new",
            "scheduling_notes": f"Screening call {status}. Candidate was not reachable. HR can retry.",
        }).eq("id", cid).eq("stage", "screening").execute()
    elif ctype == "scheduling" and cid:
        supabase.table("candidates").update({
            "stage": "shortlisted",
            "needs_manual_scheduling": True,
            "scheduling_notes": f"Scheduling call {status}. Candidate was not reachable.",
        }).eq("id", cid).eq("stage", "scheduling").execute()


class CallbackRequest(BaseModel):
    when: str               # ISO 8601 with offset
    note: str = ""


@internal.post("/calls/{call_id}/callback")
async def call_callback(call_id: str, body: CallbackRequest):
    """The candidate asked Neha to call back later: queue the same call type then."""
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    try:
        when = datetime.fromisoformat(body.when.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="when must be an ISO 8601 date-time")
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    delay = (when - datetime.now(timezone.utc)).total_seconds()
    if delay < 60 or delay > 14 * 86400:
        raise HTTPException(status_code=400, detail="Callback must be between 1 minute and 14 days away")

    from app.workers.queue import enqueue
    if not call.get("is_test"):
        enqueue(
            "call.initiate",
            {"candidate_id": call["candidate_id"], "call_type": call["call_type"]},
            delay_seconds=delay,
            dedupe_key=f"callback:{call_id}",
            org_id=call.get("org_id"),
        )
        db.get_supabase().table("candidates").update({
            "scheduling_notes": f"Asked for a callback at {when.isoformat()}. {body.note}".strip(),
        }).eq("id", call["candidate_id"]).execute()
    return {"ok": True, "scheduled_for": when.isoformat()}


# ── End of call ──────────────────────────────────────────────────────────

class TranscriptItem(BaseModel):
    speaker: str             # "neha" | "candidate"
    text: str
    timestamp: str | None = None
    interrupted: bool = False


class CompletePayload(BaseModel):
    transcript: list[TranscriptItem] = Field(default_factory=list)
    extracted: dict = Field(default_factory=dict)
    ended_naturally: bool = False
    confirmed_slot_id: int | None = None
    latency_metrics: list[dict] | None = None
    pipeline: dict | None = None
    end_reason: str | None = None
    duration_seconds: int | None = None


class AgentCallOutcome(CallOutcome):
    """CallOutcome fed by the voice agent's report instead of a live loop."""

    def __init__(self, call: dict, payload: CompletePayload):
        super().__init__(call["id"], call["call_type"], call["candidate_id"])
        self.full_transcript = [t.model_dump() for t in payload.transcript]
        self._payload = payload
        # Scheduling calls: load the interview + offered slots, then apply the
        # slot the agent confirmed through its tool.
        if self.call_type == "scheduling":
            self._build_call_context()
            self._confirmed_slot_id = payload.confirmed_slot_id

    def _extracted(self) -> dict:
        return self._payload.extracted

    def _ended_naturally(self) -> bool:
        return self._payload.ended_naturally


@internal.post("/calls/{call_id}/complete")
async def call_complete(call_id: str, payload: CompletePayload):
    call = db.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    extra = {}
    if payload.latency_metrics is not None:
        extra["latency_metrics"] = payload.latency_metrics
    if payload.pipeline is not None:
        extra["pipeline"] = payload.pipeline
    if payload.end_reason:
        extra["end_reason"] = payload.end_reason
    if extra:
        db.update_call_status(call_id, call.get("status") or "in_progress", **extra)

    if call.get("is_test"):
        # Playground: save the conversation and a score preview, but leave the
        # candidate record, calendar and emails untouched.
        transcript = "\n".join(
            f"{'Neha' if t.speaker == 'neha' else 'Candidate'}: {t.text}" for t in payload.transcript
        )
        summary = await summarize_transcript(call["call_type"], [t.model_dump() for t in payload.transcript])
        extracted = dict(payload.extracted)
        if call["call_type"] == "screening" and extracted:
            try:
                from app.services.scoring import score_candidate
                candidate = db.get_candidate(call["candidate_id"])
                if candidate:
                    extracted["_scorecard"] = await score_candidate(candidate, extracted)
            except Exception as e:
                extracted["_scorecard_error"] = str(e)
        db.complete_call(call_id, transcript=transcript, ai_summary=summary,
                         extracted_data=extracted, duration_seconds=payload.duration_seconds)
        return {"ok": True, "test": True}

    outcome = AgentCallOutcome(call, payload)
    await outcome._end_call()
    return {"ok": True}


# ── Playground (signed-in recruiters) ────────────────────────────────────

class PlaygroundRequest(BaseModel):
    candidate_id: str
    call_type: str = "screening"
    stt: str | None = None
    llm: str | None = None
    tts: str | None = None
    avatar: bool = False


@router.post("/playground/session")
async def playground_session(req: PlaygroundRequest, user: CurrentUser = Depends(require_user)):
    """Start a browser test conversation with Neha. Nothing touches the candidate record."""
    if not livekit_service.is_configured():
        raise HTTPException(status_code=503, detail="LiveKit is not configured on the backend")
    pipeline = {k: v for k, v in {"stt": req.stt, "llm": req.llm, "tts": req.tts}.items() if v}
    pipeline["avatar"] = req.avatar
    return await livekit_service.start_browser_session(
        candidate_id=req.candidate_id,
        call_type=req.call_type,
        channel="playground",
        user_identity=f"tester-{user.id}",
        user_name=user.email or "Tester",
        pipeline=pipeline,
        is_test=True,
    )


@router.post("/playground/{call_id}/end")
async def playground_end(call_id: str):
    call = db.get_call(call_id)
    if call and call.get("room_name"):
        await livekit_service.end_room(call["room_name"])
    return {"ok": True}
