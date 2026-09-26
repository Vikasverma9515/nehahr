"""Offers: draft, approve, send, and click-to-sign acceptance.

The candidate signs by typing their full name on /offer/<token>. We store
the name, time, IP, user agent and a SHA-256 of the exact letter they saw,
which is an electronic signature under India's IT Act 2000 (s.3A/s.5) for
most employment offers. For Aadhaar eSign or DocuSign, plug a provider in
at ``accept`` later.
"""

from __future__ import annotations

import hashlib
import html
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.security import CurrentUser, require_user
from app.services import db
from app.services.tenancy import scope, stamp

router = APIRouter()
public_router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _link(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/offer/{token}"


def total_lpa(ctc: dict) -> float:
    return float(ctc.get("fixed") or 0) + float(ctc.get("variable") or 0)


def build_letter(*, company: str, candidate_name: str, designation: str, ctc: dict,
                 joining_date: str | None, location: str | None, reporting_to: str | None,
                 expires: str | None) -> str:
    """A plain, editable offer letter. HR can rewrite any part before sending."""
    e = html.escape
    first = e(candidate_name.split(" ")[0])
    rows = [("Designation", designation), ("Fixed pay", f"₹{ctc.get('fixed', 0):g} lakhs per annum")]
    if ctc.get("variable"):
        rows.append(("Variable pay (target)", f"₹{ctc['variable']:g} lakhs per annum"))
    if ctc.get("joining_bonus"):
        rows.append(("Joining bonus (one-time)", f"₹{ctc['joining_bonus']:g} lakhs"))
    rows.append(("Total annual CTC", f"₹{total_lpa(ctc):g} lakhs per annum"))
    if joining_date:
        rows.append(("Date of joining", joining_date))
    if location:
        rows.append(("Work location", location))
    if reporting_to:
        rows.append(("Reporting to", reporting_to))
    table = "".join(f"<tr><td>{e(k)}</td><td><strong>{e(str(v))}</strong></td></tr>" for k, v in rows)
    return f"""<h2>Offer of employment</h2>
<p>Dear {first},</p>
<p>We are delighted to offer you the position of <strong>{e(designation)}</strong> at {e(company)}.
We enjoyed getting to know you through the interview process and believe you will make a real difference to the team.</p>
<table>{table}</table>
<p>This offer is subject to satisfactory verification of your documents and references, and to the
terms of our standard employment agreement, which you will receive on joining. Your compensation is
confidential.</p>
<p>{'Please accept this offer by ' + e(expires) + '.' if expires else 'Please let us know your decision at the earliest.'}
To accept, type your full name below and select <em>Accept offer</em>.</p>
<p>We look forward to welcoming you.</p>
<p>Warm regards,<br>The {e(company)} Recruiting Team</p>"""


def _approval_needed(job: dict, ctc: dict) -> bool:
    top = job.get("salary_range_max")
    return bool(top) and total_lpa(ctc) > float(top)


# ── Recruiter routes ─────────────────────────────────────────────────────

class OfferDraft(BaseModel):
    candidate_id: str
    designation: str
    fixed_lpa: float
    variable_lpa: float = 0
    joining_bonus_lpa: float = 0
    joining_date: date | None = None
    work_location: str | None = None
    reporting_to: str | None = None
    expires_in_days: int = 5


@router.post("")
async def create_offer(req: OfferDraft, user: CurrentUser = Depends(require_user)):
    candidate = db.get_candidate(req.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    from app.services.messaging import company_name

    job = candidate.get("jobs") or {}
    ctc = {"fixed": req.fixed_lpa, "variable": req.variable_lpa, "joining_bonus": req.joining_bonus_lpa}
    expires_at = _now() + timedelta(days=max(1, min(req.expires_in_days, 30)))
    letter = build_letter(
        company=company_name(candidate), candidate_name=candidate.get("name") or "Candidate",
        designation=req.designation, ctc=ctc,
        joining_date=req.joining_date.strftime("%d %B %Y") if req.joining_date else None,
        location=req.work_location, reporting_to=req.reporting_to,
        expires=expires_at.strftime("%d %B %Y"),
    )
    needs_approval = _approval_needed(job, ctc)
    row = stamp({
        "candidate_id": candidate["id"], "job_id": candidate.get("job_id"), "token": secrets.token_urlsafe(20),
        "designation": req.designation, "ctc": ctc,
        "joining_date": req.joining_date.isoformat() if req.joining_date else None,
        "work_location": req.work_location, "reporting_to": req.reporting_to,
        "expires_at": expires_at.isoformat(), "letter_html": letter,
        "approval_required": needs_approval,
        "status": "pending_approval" if needs_approval else "draft",
        "created_by": None if user.is_service else user.id,
    })
    if candidate.get("org_id") and not row.get("org_id"):
        row["org_id"] = candidate["org_id"]
    return db.get_supabase().table("offers").insert(row).execute().data[0]


def _offer(offer_id: str) -> dict:
    res = db.get_supabase().table("offers").select("*").eq("id", offer_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Offer not found")
    return res.data[0]


class OfferEdit(BaseModel):
    letter_html: str


@router.patch("/{offer_id}")
async def edit_offer(offer_id: str, body: OfferEdit):
    offer = _offer(offer_id)
    if offer["status"] not in ("draft", "pending_approval", "approved"):
        raise HTTPException(status_code=409, detail="A sent offer can't be edited; withdraw it and create a new one")
    return db.get_supabase().table("offers").update({"letter_html": body.letter_html}).eq(
        "id", offer_id).execute().data[0]


def _is_admin(user: CurrentUser) -> bool:
    if user.is_service or not user.org_id:
        return True
    res = db.get_supabase().table("org_members").select("role").eq("org_id", user.org_id).eq(
        "user_id", user.id).limit(1).execute()
    return bool(res.data) and res.data[0]["role"] == "admin"


@router.post("/{offer_id}/approve")
async def approve_offer(offer_id: str, user: CurrentUser = Depends(require_user)):
    offer = _offer(offer_id)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Only an admin can approve an offer above the salary band")
    if offer["status"] != "pending_approval":
        raise HTTPException(status_code=409, detail="This offer isn't waiting for approval")
    return db.get_supabase().table("offers").update({
        "status": "approved", "approved_by": None if user.is_service else user.id, "approved_at": _now().isoformat(),
    }).eq("id", offer_id).execute().data[0]


@router.post("/{offer_id}/send")
async def send_offer(offer_id: str):
    offer = _offer(offer_id)
    if offer["status"] == "pending_approval":
        raise HTTPException(status_code=409, detail="This offer is above the salary band and needs an admin's approval")
    if offer["status"] not in ("draft", "approved", "sent"):
        raise HTTPException(status_code=409, detail=f"Offer is {offer['status']}")
    candidate = db.get_candidate(offer["candidate_id"]) or {}
    from app.services import messaging
    from app.services.mailer import send_email

    first = (candidate.get("name") or "there").split(" ")[0]
    link = _link(offer["token"])
    emailed = False
    if candidate.get("email"):
        emailed = bool(await send_email(
            to=candidate["email"],
            subject=f"Your offer from {messaging.company_name(candidate)}",
            title=f"Congratulations, {first}!",
            paragraphs=[f"We're delighted to offer you the {offer['designation']} role. Your offer letter is ready "
                        "to read and accept online."],
            button=("View my offer", link),
        ))
    messaging.try_send(candidate["id"], f"Congratulations {first}! Your offer for {offer['designation']} is ready: {link}",
                       "offer")
    db.get_supabase().table("offers").update({"status": "sent", "sent_at": _now().isoformat()}).eq("id", offer_id).execute()
    db.get_supabase().table("candidates").update({"stage": "offer"}).eq("id", offer["candidate_id"]).in_(
        "stage", ["interviewing", "scheduled", "shortlisted", "screened"]).execute()
    return {"ok": True, "link": link, "emailed": emailed}


@router.post("/{offer_id}/withdraw")
async def withdraw_offer(offer_id: str):
    offer = _offer(offer_id)
    if offer["status"] in ("accepted", "declined"):
        raise HTTPException(status_code=409, detail=f"Offer already {offer['status']}")
    db.get_supabase().table("offers").update({"status": "withdrawn"}).eq("id", offer_id).execute()
    return {"ok": True}


@router.get("")
async def list_offers(candidate_id: str):
    res = scope(db.get_supabase().table("offers").select(
        "id, status, designation, ctc, joining_date, expires_at, sent_at, responded_at, approval_required, "
        "decline_reason, signature_name, token, created_at"
    )).eq("candidate_id", candidate_id).order("created_at", desc=True).execute()
    return {"offers": res.data or []}


# ── Candidate routes ─────────────────────────────────────────────────────

def _by_token(token: str) -> dict:
    res = db.get_supabase().table("offers").select("*, candidates(name)").eq("token", token).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This offer link isn't valid")
    offer = res.data[0]
    if offer["status"] == "sent" and offer.get("expires_at") and \
            datetime.fromisoformat(offer["expires_at"].replace("Z", "+00:00")) < _now():
        db.get_supabase().table("offers").update({"status": "expired"}).eq("id", offer["id"]).execute()
        offer["status"] = "expired"
    return offer


@public_router.get("/public/{token}")
async def view_offer(token: str):
    offer = _by_token(token)
    if offer["status"] in ("draft", "pending_approval", "approved"):
        raise HTTPException(status_code=404, detail="This offer link isn't valid")
    if not offer.get("viewed_at"):
        db.get_supabase().table("offers").update({"viewed_at": _now().isoformat()}).eq("id", offer["id"]).execute()
    return {
        "status": offer["status"],
        "candidate_name": (offer.get("candidates") or {}).get("name"),
        "designation": offer["designation"],
        "letter_html": offer["letter_html"],
        "expires_at": offer.get("expires_at"),
        "signature_name": offer.get("signature_name"),
        "responded_at": offer.get("responded_at"),
    }


class AcceptRequest(BaseModel):
    full_name: str
    agree: bool


@public_router.post("/public/{token}/accept")
async def accept_offer(token: str, body: AcceptRequest, request: Request):
    offer = _by_token(token)
    if offer["status"] != "sent":
        raise HTTPException(status_code=409, detail=f"This offer is {offer['status']}")
    name = " ".join(body.full_name.split())
    expected = ((offer.get("candidates") or {}).get("name") or "").strip()
    if not body.agree or len(name) < 3:
        raise HTTPException(status_code=400, detail="Type your full name and tick the box to accept")
    if expected and name.lower().split(" ")[0] != expected.lower().split(" ")[0]:
        raise HTTPException(status_code=400, detail=f"Please sign with your own name as on your application ({expected})")
    now = _now().isoformat()
    supabase = db.get_supabase()
    supabase.table("offers").update({
        "status": "accepted", "responded_at": now, "signature_name": name,
        "signature_ip": (request.headers.get("x-forwarded-for") or (request.client.host if request.client else ""))[:100],
        "signature_user_agent": (request.headers.get("user-agent") or "")[:300],
        "letter_sha256": hashlib.sha256(offer["letter_html"].encode("utf-8")).hexdigest(),
    }).eq("id", offer["id"]).execute()
    supabase.table("candidates").update({
        "stage": "pre_joining", "offer_accepted_at": now, "offer_ctc": offer["ctc"],
        "joining_date": offer.get("joining_date"), "pre_joining_status": "confirmed",
        "last_contact_at": now,
    }).eq("id", offer["candidate_id"]).execute()
    return {"ok": True}


class DeclineRequest(BaseModel):
    reason: str = ""


@public_router.post("/public/{token}/decline")
async def decline_offer(token: str, body: DeclineRequest):
    offer = _by_token(token)
    if offer["status"] != "sent":
        raise HTTPException(status_code=409, detail=f"This offer is {offer['status']}")
    now = _now().isoformat()
    supabase = db.get_supabase()
    supabase.table("offers").update({"status": "declined", "responded_at": now,
                                     "decline_reason": body.reason[:1000]}).eq("id", offer["id"]).execute()
    row = {"candidate_id": offer["candidate_id"], "kind": "message",
           "details": f"Declined the offer. {body.reason}".strip()}
    if offer.get("org_id"):
        row["org_id"] = offer["org_id"]
    supabase.table("candidate_requests").insert(row).execute()
    return {"ok": True}
