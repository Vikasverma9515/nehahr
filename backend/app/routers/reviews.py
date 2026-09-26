"""Share candidates with a hiring manager for one-click decisions.

Recruiters create a link for a job (all screened candidates, or a chosen
few). The manager opens it without an account, sees a one-page brief per
candidate (scores, what Neha heard, resume match, AI interview) and clicks
Advance / Maybe / Reject. Advance shortlists the candidate; reject closes
them with the manager's note; every decision is logged.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.security import CurrentUser, require_user
from app.services import db
from app.services.tenancy import scope, stamp

router = APIRouter()
public_router = APIRouter()


class CreateReview(BaseModel):
    job_id: str
    candidate_ids: list[str] | None = None
    reviewer_name: str | None = None
    reviewer_email: str | None = None
    message: str | None = None
    expires_in_days: int = 14


def _link(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/review/{token}"


@router.post("")
async def create_review(req: CreateReview, user: CurrentUser = Depends(require_user)):
    supabase = db.get_supabase()
    ids = req.candidate_ids
    if not ids:
        rows = scope(supabase.table("candidates").select("id")).eq("job_id", req.job_id).in_(
            "stage", ["screened", "shortlisted"]).order("score", desc=True).limit(50).execute().data or []
        ids = [r["id"] for r in rows]
    if not ids:
        raise HTTPException(status_code=400, detail="No screened candidates to share for this job yet")
    token = secrets.token_urlsafe(20)
    row = stamp({
        "token": token, "job_id": req.job_id, "candidate_ids": ids,
        "reviewer_name": req.reviewer_name, "reviewer_email": req.reviewer_email, "message": req.message,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=max(1, min(req.expires_in_days, 60)))).isoformat(),
        "created_by": None if user.is_service else user.id,
    })
    supabase.table("review_links").insert(row).execute()

    emailed = False
    if req.reviewer_email:
        from app.services.mailer import send_email
        job = supabase.table("jobs").select("title").eq("id", req.job_id).single().execute().data or {}
        emailed = bool(await send_email(
            to=req.reviewer_email,
            subject=f"{len(ids)} candidates for {job.get('title', 'your role')} need your call",
            title=f"Hi {(req.reviewer_name or 'there').split(' ')[0]}, please review these candidates",
            paragraphs=[p for p in [
                req.message,
                f"Neha has screened {len(ids)} candidates for {job.get('title', 'the role')}. Each one has a "
                "short brief: scores, what they said on the call and how their resume matches. "
                "Advance, hold or reject each with one click. No login needed.",
            ] if p],
            button=("Review candidates", _link(token)),
        ))
    return {"link": _link(token), "emailed": emailed, "count": len(ids)}


# ── Manager side ─────────────────────────────────────────────────────────

def _review_link(token: str) -> dict:
    res = db.get_supabase().table("review_links").select("*, jobs(title)").eq("token", token).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This review link isn't valid")
    link = res.data[0]
    if datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This review link has expired")
    return link


@public_router.get("/public/{token}")
async def review_page(token: str):
    link = _review_link(token)
    supabase = db.get_supabase()
    ids = link["candidate_ids"]
    cands = supabase.table("candidates").select(
        "id, name, stage, score, score_breakdown, qualification_status, current_location, current_title, "
        "current_company, experience_years, notice_period_days, expected_ctc, current_ctc, skills, "
        "match_score, match_reasons, disqualification_reason"
    ).in_("id", ids).execute().data or []
    calls = supabase.table("calls").select("candidate_id, ai_summary, created_at").in_(
        "candidate_id", ids).eq("call_type", "screening").eq("status", "completed").order(
        "created_at", desc=True).execute().data or []
    summaries: dict[str, str] = {}
    for c in calls:
        summaries.setdefault(c["candidate_id"], c.get("ai_summary") or "")
    ai: dict[str, dict] = {}
    try:
        for r in supabase.table("ai_interviews").select("candidate_id, score, summary").in_(
                "candidate_id", ids).eq("status", "completed").execute().data or []:
            ai.setdefault(r["candidate_id"], r)
    except Exception:
        pass
    decided = {r["candidate_id"]: r for r in supabase.table("candidate_reviews").select(
        "candidate_id, decision, note").eq("link_id", link["id"]).execute().data or []}

    order = {cid: i for i, cid in enumerate(ids)}
    return {
        "job_title": (link.get("jobs") or {}).get("title"),
        "reviewer_name": link.get("reviewer_name"),
        "message": link.get("message"),
        "candidates": sorted([{
            **{k: c.get(k) for k in ("id", "name", "score", "score_breakdown", "current_location", "current_title",
                                    "current_company", "experience_years", "notice_period_days", "expected_ctc",
                                    "current_ctc", "skills", "match_score", "match_reasons")},
            "screening_summary": summaries.get(c["id"]),
            "ai_interview": ai.get(c["id"]),
            "decision": decided.get(c["id"]),
        } for c in cands], key=lambda c: order.get(c["id"], 0)),
    }


class Decision(BaseModel):
    candidate_id: str
    decision: str          # advance | maybe | reject
    note: str | None = None


@public_router.post("/public/{token}/decide")
async def decide(token: str, body: Decision):
    link = _review_link(token)
    if body.candidate_id not in link["candidate_ids"]:
        raise HTTPException(status_code=404, detail="Candidate not in this review")
    if body.decision not in ("advance", "maybe", "reject"):
        raise HTTPException(status_code=400, detail="Unknown decision")
    supabase = db.get_supabase()
    row = {"link_id": link["id"], "candidate_id": body.candidate_id, "decision": body.decision,
           "note": (body.note or "")[:1000], "reviewer_name": link.get("reviewer_name")}
    if link.get("org_id"):
        row["org_id"] = link["org_id"]
    supabase.table("candidate_reviews").upsert(row, on_conflict="link_id,candidate_id").execute()

    who = link.get("reviewer_name") or "Hiring manager"
    now = datetime.now(timezone.utc).isoformat()
    if body.decision == "advance":
        supabase.table("candidates").update({
            "stage": "shortlisted", "qualification_status": "qualified",
            "scheduling_notes": f"{who} advanced this candidate. {body.note or ''}".strip(), "last_contact_at": now,
        }).eq("id", body.candidate_id).in_("stage", ["new", "screened"]).execute()
    elif body.decision == "reject":
        supabase.table("candidates").update({
            "stage": "rejected", "qualification_status": "unqualified",
            "disqualification_reason": f"{who}: {body.note or 'not a fit'}",
        }).eq("id", body.candidate_id).in_("stage", ["new", "screened", "shortlisted"]).execute()
    return {"ok": True}
