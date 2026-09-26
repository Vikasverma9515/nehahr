"""Candidate self-serve portal.

Each candidate gets a private link (/c/<token>) where they can see where
their application stands, book an interview slot themselves, ask Neha to
call now or later, reschedule, or withdraw. The token is the credential,
so responses only carry what the candidate may see.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.services import db

router = APIRouter()          # recruiter (signed in)
public_router = APIRouter()   # candidate (token)

STEPS = ["Applied", "Screening", "Interview", "Decision", "Offer", "Joined"]
STAGE_STEP = {
    "new": 0, "screening": 1, "screened": 1, "shortlisted": 2, "scheduling": 2, "scheduled": 2,
    "interviewing": 2, "offer": 4, "pre_joining": 4, "joined": 5, "rejected": 3, "withdrawn": 3, "no_show": 2,
}
STAGE_LINE = {
    "new": "We've got your application. Neha will call you for a short screening chat.",
    "screening": "Your screening call is under way.",
    "screened": "Thanks for the screening chat. The team is reviewing it now.",
    "shortlisted": "Good news: you're shortlisted. Pick an interview time below.",
    "scheduling": "We're finding an interview time with you.",
    "scheduled": "Your interview is booked. Details below.",
    "interviewing": "You're in the interview rounds.",
    "offer": "You're at the offer stage. HR will share the details with you.",
    "pre_joining": "We're getting ready for your first day.",
    "joined": "Welcome aboard!",
    "rejected": "The team has decided not to move forward this time. Thank you for your time.",
    "withdrawn": "Your application is withdrawn.",
    "no_show": "We missed you at the interview. Reach out below to reschedule.",
}


def portal_link(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/c/{token}"


def ensure_token(candidate_id: str) -> str:
    c = db.get_supabase().table("candidates").select("portal_token").eq("id", candidate_id).single().execute().data
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if c.get("portal_token"):
        return c["portal_token"]
    token = secrets.token_urlsafe(18)
    db.get_supabase().table("candidates").update({"portal_token": token}).eq("id", candidate_id).execute()
    return token


@router.post("/link/{candidate_id}")
async def get_link(candidate_id: str):
    return {"link": portal_link(ensure_token(candidate_id))}


# ── Candidate side ───────────────────────────────────────────────────────

def _candidate(token: str) -> dict:
    res = db.get_supabase().table("candidates").select(
        "id, name, stage, job_id, org_id, jobs(title, default_interviewer_id, default_interview_type, "
        "default_interview_duration_minutes)"
    ).eq("portal_token", token).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This link isn't valid")
    return res.data[0]


def _can_self_schedule(c: dict) -> bool:
    return c.get("stage") in ("shortlisted", "no_show") and bool((c.get("jobs") or {}).get("default_interviewer_id"))


@public_router.get("/{token}")
async def portal(token: str):
    c = _candidate(token)
    supabase = db.get_supabase()
    job = c.get("jobs") or {}
    from app.services.messaging import company_name

    upcoming = supabase.table("interviews").select(
        "scheduled_at, interview_type, duration_minutes, meeting_link, round_number"
    ).eq("candidate_id", c["id"]).eq("status", "scheduled").not_.is_("scheduled_at", "null").order(
        "scheduled_at").limit(1).execute().data
    ai = []
    try:
        ai = supabase.table("ai_interviews").select("token, status, expires_at").eq(
            "candidate_id", c["id"]).eq("status", "invited").order("invited_at", desc=True).limit(1).execute().data
    except Exception:
        pass
    stage = c.get("stage") or "new"
    return {
        "first_name": (c.get("name") or "").split(" ")[0],
        "company": company_name(c),
        "job_title": job.get("title"),
        "stage": stage,
        "message": STAGE_LINE.get(stage, "Your application is in progress."),
        "steps": STEPS,
        "step": STAGE_STEP.get(stage, 0),
        "next_interview": upcoming[0] if upcoming else None,
        "ai_interview_link": f"/interview/{ai[0]['token']}" if ai else None,
        "can_self_schedule": _can_self_schedule(c),
        "documents": _documents(c) if stage in DOC_STAGES else None,
        "closed": stage in ("rejected", "withdrawn", "joined"),
    }


async def _slots_for(c: dict) -> list[dict]:
    from app.services import calendar_service
    job = c.get("jobs") or {}
    return await calendar_service.get_available_slots(
        interviewer_id=job["default_interviewer_id"],
        duration_minutes=job.get("default_interview_duration_minutes") or 60,
        num_slots=12,
        days_ahead=10,
    )


@public_router.get("/{token}/slots")
async def slots(token: str):
    c = _candidate(token)
    if not _can_self_schedule(c):
        raise HTTPException(status_code=409, detail="Interview booking isn't open for you right now")
    return {"slots": await _slots_for(c)}


class BookRequest(BaseModel):
    start: str


@public_router.post("/{token}/book")
async def book(token: str, body: BookRequest):
    """Book one of the currently free slots. Re-checks the calendar first."""
    c = _candidate(token)
    if not _can_self_schedule(c):
        raise HTTPException(status_code=409, detail="Interview booking isn't open for you right now")
    free = await _slots_for(c)
    slot = next((s for s in free if s.get("start") == body.start), None)
    if not slot:
        raise HTTPException(status_code=409, detail="That time was just taken. Please pick another.")

    job = c.get("jobs") or {}
    supabase = db.get_supabase()
    passed = supabase.table("interviews").select("round_number").eq("candidate_id", c["id"]).eq(
        "result", "pass").execute().data or []
    round_number = (max(r.get("round_number") or 1 for r in passed) + 1) if passed else 1
    iv = supabase.table("interviews").insert({
        "candidate_id": c["id"], "job_id": c.get("job_id"),
        "interviewer_id": job["default_interviewer_id"],
        "interview_type": job.get("default_interview_type") or "video",
        "duration_minutes": job.get("default_interview_duration_minutes") or 60,
        "status": "scheduled", "offered_slots": [slot], "round_number": round_number,
        **({"org_id": c["org_id"]} if c.get("org_id") else {}),
    }).execute().data[0]

    from app.services.call_outcome import CallOutcome
    outcome = CallOutcome(call_id="portal", call_type="scheduling", candidate_id=c["id"])
    outcome._interview_id = iv["id"]
    outcome._offered_slots = [slot]
    outcome._confirmed_slot_id = 1
    await outcome._book_confirmed_slot()
    if not outcome._booking_result:
        supabase.table("interviews").update({"status": "cancelled"}).eq("id", iv["id"]).execute()
        raise HTTPException(status_code=502, detail="Couldn't reach the calendar. Please try again in a minute.")
    return {"ok": True, "slot": slot, "meeting_link": outcome._booking_result.get("meet_link")}


class CallMeRequest(BaseModel):
    when: str | None = None      # ISO 8601; empty = now


@public_router.post("/{token}/call-me")
async def call_me(token: str, body: CallMeRequest):
    c = _candidate(token)
    if c.get("stage") in ("rejected", "withdrawn", "joined"):
        raise HTTPException(status_code=409, detail="There's nothing to call about right now")
    delay = 15.0
    if body.when:
        try:
            when = datetime.fromisoformat(body.when.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time")
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        delay = (when - datetime.now(timezone.utc)).total_seconds()
        if delay < 0 or delay > 7 * 86400:
            raise HTTPException(status_code=400, detail="Pick a time in the next 7 days")
    call_type = {"new": "screening", "screening": "screening", "shortlisted": "scheduling",
                 "scheduling": "scheduling"}.get(c.get("stage") or "new", "screening")
    from app.workers.queue import enqueue
    slot = int(datetime.now(timezone.utc).timestamp() // 600)
    # The candidate asked for this call, so calling hours don't apply.
    queued = enqueue("call.initiate", {"candidate_id": c["id"], "call_type": call_type, "ignore_calling_hours": True},
                     delay_seconds=max(15.0, delay), dedupe_key=f"portal-call:{c['id']}:{slot}")
    return {"ok": True, "queued": queued is not None,
            "at": (datetime.now(timezone.utc) + timedelta(seconds=max(15.0, delay))).isoformat()}


class PortalRequest(BaseModel):
    kind: str
    details: str = ""


@public_router.post("/{token}/request")
async def request(token: str, body: PortalRequest):
    c = _candidate(token)
    if body.kind not in ("reschedule", "withdraw", "question"):
        raise HTTPException(status_code=400, detail="Unknown request")
    row = {"candidate_id": c["id"], "kind": body.kind, "details": body.details[:1000]}
    if c.get("org_id"):
        row["org_id"] = c["org_id"]
    db.get_supabase().table("candidate_requests").insert(row).execute()
    if body.kind == "reschedule":
        db.get_supabase().table("candidates").update({
            "needs_manual_scheduling": True,
            "scheduling_notes": f"Asked to reschedule from the portal: {body.details}".strip(),
        }).eq("id", c["id"]).execute()
    return {"ok": True}


# ── Onboarding documents ─────────────────────────────────────────────────

DOC_STAGES = {"offer", "pre_joining", "joined"}
DEFAULT_DOCS = [
    {"kind": "pan", "label": "PAN card"},
    {"kind": "aadhaar", "label": "Aadhaar card"},
    {"kind": "degree", "label": "Highest degree certificate"},
    {"kind": "payslips", "label": "Last 3 payslips"},
    {"kind": "relieving_letter", "label": "Relieving or resignation acceptance letter"},
    {"kind": "bank", "label": "Cancelled cheque or bank statement"},
    {"kind": "photo", "label": "Passport-size photo"},
]


def _checklist(c: dict) -> list[dict]:
    from app.services.compliance import org_settings
    return org_settings(c.get("org_id")).get("onboarding_documents") or DEFAULT_DOCS


def _documents(c: dict) -> list[dict]:
    uploaded = db.get_supabase().table("candidate_documents").select(
        "id, kind, file_name, status, note, uploaded_at").eq("candidate_id", c["id"]).order(
        "uploaded_at", desc=True).execute().data or []
    latest: dict[str, dict] = {}
    for d in uploaded:
        latest.setdefault(d["kind"], d)
    return [{**item, "upload": latest.get(item["kind"])} for item in _checklist(c)]


@public_router.post("/{token}/documents")
async def upload_document(token: str, kind: str = Form(...), file: UploadFile = File(...)):
    c = _candidate(token)
    if (c.get("stage") or "") not in DOC_STAGES:
        raise HTTPException(status_code=409, detail="Documents open once you have an offer")
    if kind not in {d["kind"] for d in _checklist(c)}:
        raise HTTPException(status_code=400, detail="Unknown document")
    name = (file.filename or "document").lower()
    if not name.endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Upload a PDF, JPG or PNG")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Files must be under 8 MB")
    import uuid
    path = f"{c.get('org_id') or 'shared'}/{c['id']}/{kind}-{uuid.uuid4().hex[:8]}-{name}"
    supabase = db.get_supabase()
    try:
        supabase.storage.from_("documents").upload(path, data, {"content-type": file.content_type or "application/octet-stream"})
    except Exception:
        raise HTTPException(status_code=503, detail="Uploads aren't available right now; please try later")
    row = {"candidate_id": c["id"], "kind": kind, "file_path": path, "file_name": file.filename}
    if c.get("org_id"):
        row["org_id"] = c["org_id"]
    supabase.table("candidate_documents").insert(row).execute()
    return {"ok": True}
