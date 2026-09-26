"""AI video interviews in our own LiveKit room.

Recruiter routes (signed in):
    POST /api/ai-interviews                 invite a candidate (email + link)
    GET  /api/ai-interviews?candidate_id=   list invites for a candidate
    POST /api/ai-interviews/{id}/observe    watch live (and take over)
    POST /api/ai-interviews/{id}/cancel

Candidate routes (the link token is the credential):
    GET  /api/ai-interviews/public/{token}
    POST /api/ai-interviews/public/{token}/join
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.security import CurrentUser, require_user
from app.services import db, livekit_service
from app.services.tenancy import scope, stamp

router = APIRouter()
public_router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _link(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/interview/{token}"


class InviteRequest(BaseModel):
    candidate_id: str
    expires_in_hours: int = 72
    send_email: bool = True


@router.post("")
async def invite(req: InviteRequest, user: CurrentUser = Depends(require_user)):
    candidate = db.get_candidate(req.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    hours = max(1, min(req.expires_in_hours, 24 * 14))
    token = secrets.token_urlsafe(24)
    row = stamp({
        "candidate_id": candidate["id"],
        "job_id": candidate.get("job_id"),
        "token": token,
        "expires_at": (_now() + timedelta(hours=hours)).isoformat(),
        "invited_by": None if user.is_service else user.id,
    })
    if candidate.get("org_id") and not row.get("org_id"):
        row["org_id"] = candidate["org_id"]
    created = db.get_supabase().table("ai_interviews").insert(row).execute().data[0]

    emailed = False
    if req.send_email and candidate.get("email"):
        from app.services.mailer import send_email
        job = (candidate.get("jobs") or {}).get("title") or "the role"
        first = (candidate.get("name") or "there").split(" ")[0]
        emailed = bool(await send_email(
            to=candidate["email"],
            subject=f"Your first-round interview for {job}",
            title=f"Hi {first}, you're invited to a short video interview",
            paragraphs=[
                f"Thanks for applying for {job}. The next step is a 15-minute first-round interview "
                "with Neha, our AI recruiter. You can take it any time before the link expires.",
                f"The link is valid for {hours} hours. Use a laptop or phone with a camera and "
                "microphone, somewhere quiet. The conversation is recorded for the hiring team.",
            ],
            button=("Start my interview", _link(token)),
        ))
    return {**created, "link": _link(token), "emailed": emailed}


@router.get("")
async def list_invites(candidate_id: str):
    res = scope(db.get_supabase().table("ai_interviews").select(
        "id, status, expires_at, invited_at, started_at, completed_at, score, summary, call_id, attempts"
    )).eq("candidate_id", candidate_id).order("invited_at", desc=True).execute()
    return {"ai_interviews": res.data or []}


def _get(ai_id: str) -> dict:
    res = db.get_supabase().table("ai_interviews").select("*").eq("id", ai_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Not found")
    return res.data[0]


@router.post("/{ai_id}/cancel")
async def cancel(ai_id: str):
    row = _get(ai_id)
    db.get_supabase().table("ai_interviews").update({"status": "cancelled"}).eq("id", row["id"]).execute()
    if row.get("room_name"):
        await livekit_service.end_room(row["room_name"])
    return {"ok": True}


@router.post("/{ai_id}/observe")
async def observe(ai_id: str, user: CurrentUser = Depends(require_user)):
    """Join the live room as a recruiter. Starts muted; unmuting pauses Neha."""
    row = _get(ai_id)
    if row["status"] != "in_progress" or not row.get("room_name"):
        raise HTTPException(status_code=409, detail="The interview is not live right now")
    token = livekit_service.participant_token(
        row["room_name"], identity=f"recruiter-{user.id}", name=user.email or "Recruiter",
        attributes={"role": "recruiter"},
    )
    return {"url": settings.livekit_url, "token": token, "room": row["room_name"]}


# ── Candidate side ───────────────────────────────────────────────────────

def _by_token(token: str) -> dict:
    res = db.get_supabase().table("ai_interviews").select(
        "*, candidates(name, email), jobs(title)"
    ).eq("token", token).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This interview link is not valid")
    row = res.data[0]
    if row["status"] == "invited" and datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) < _now():
        db.get_supabase().table("ai_interviews").update({"status": "expired"}).eq("id", row["id"]).execute()
        row["status"] = "expired"
    return row


@public_router.get("/public/{token}")
async def public_info(token: str):
    row = _by_token(token)
    cand = row.get("candidates") or {}
    company = settings.hr_company_name
    if row.get("org_id"):
        try:
            company = db.get_supabase().table("organizations").select("name").eq(
                "id", row["org_id"]).single().execute().data["name"]
        except Exception:
            pass
    return {
        "first_name": (cand.get("name") or "").split(" ")[0],
        "job_title": (row.get("jobs") or {}).get("title"),
        "company": company,
        "status": row["status"],
        "expires_at": row["expires_at"],
        "attempts_left": max(0, row["max_attempts"] - row["attempts"]),
    }


class JoinRequest(BaseModel):
    consent: bool
    display_name: str | None = None


@public_router.post("/public/{token}/join")
async def join(token: str, body: JoinRequest):
    if not body.consent:
        raise HTTPException(status_code=400, detail="Please agree to the recording to continue")
    row = _by_token(token)
    cand = row.get("candidates") or {}
    name = body.display_name or cand.get("name") or "Candidate"
    supabase = db.get_supabase()

    # Reconnecting to a live interview (dropped Wi-Fi, reloaded tab).
    if row["status"] == "in_progress" and row.get("room_name"):
        return {
            "url": settings.livekit_url,
            "room": row["room_name"],
            "token": livekit_service.participant_token(
                row["room_name"], identity=f"candidate-{row['candidate_id']}", name=name,
                attributes={"role": "candidate"}),
        }
    if row["status"] != "invited":
        raise HTTPException(status_code=409, detail=f"This interview is {row['status'].replace('_', ' ')}")
    if row["attempts"] >= row["max_attempts"]:
        raise HTTPException(status_code=409, detail="No attempts left on this link")
    if not livekit_service.is_configured():
        raise HTTPException(status_code=503, detail="Video interviews are not available right now")

    session = await livekit_service.start_browser_session(
        candidate_id=row["candidate_id"],
        call_type="interview",
        channel="room",
        user_identity=f"candidate-{row['candidate_id']}",
        user_name=name,
        pipeline={"avatar": True},
        extra_metadata={"ai_interview_id": row["id"]},
    )
    supabase.table("ai_interviews").update({
        "status": "in_progress",
        "attempts": row["attempts"] + 1,
        "call_id": session["call_id"],
        "room_name": session["room"],
        "started_at": _now().isoformat(),
    }).eq("id", row["id"]).execute()
    await livekit_service.start_room_recording(session["room"], session["call_id"])
    return {"url": session["url"], "room": session["room"], "token": session["token"]}
