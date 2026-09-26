"""WhatsApp and SMS with candidates, through the same Twilio account as calls.

Outbound: ``send(candidate_id, body, purpose)`` uses WhatsApp when a WhatsApp
sender is configured and falls back to SMS. Business-initiated WhatsApp
outside the 24-hour window needs an approved template: set
``TWILIO_WA_TEMPLATES`` to a JSON map of purpose → Content SID and the
template gets the candidate's first name and the message text as variables.

Inbound: ``handle_inbound`` stores the message and has Neha reply (status
questions, reschedules, "call me now"), or hands it to HR.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.config import settings
from app.services import db

log = logging.getLogger("neha.messaging")

STOP_WORDS = {"stop", "unsubscribe", "opt out", "optout"}


def _twilio():
    from app.services.call_service import call_service
    return call_service.client


def _templates() -> dict:
    try:
        return json.loads(settings.twilio_wa_templates or "{}")
    except json.JSONDecodeError:
        return {}


def channel_available() -> str | None:
    if settings.twilio_whatsapp_number:
        return "whatsapp"
    if settings.twilio_sms_number or settings.twilio_phone_number:
        return "sms"
    return None


def send(candidate_id: str, body: str, purpose: str = "manual", author: str = "neha") -> dict:
    """Send a message to a candidate and log it. Returns the messages row."""
    from app.services.phone import to_e164

    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise ValueError("Candidate not found")
    if candidate.get("messaging_opt_out"):
        raise ValueError("The candidate opted out of messages")
    channel = channel_available()
    if not channel:
        raise ValueError("No WhatsApp or SMS sender configured")
    to = to_e164(candidate["phone"])

    row = {
        "candidate_id": candidate_id, "channel": channel, "direction": "outbound",
        "body": body, "purpose": purpose, "author": author, "to_number": to,
    }
    if candidate.get("org_id"):
        row["org_id"] = candidate["org_id"]

    kwargs: dict = {"status_callback": f"{settings.backend_url}/api/webhooks/twilio/message-status"}
    if channel == "whatsapp":
        kwargs["from_"] = f"whatsapp:{settings.twilio_whatsapp_number}"
        kwargs["to"] = f"whatsapp:{to}"
        content_sid = _templates().get(purpose)
        if content_sid:
            first = (candidate.get("name") or "there").split(" ")[0]
            kwargs["content_sid"] = content_sid
            kwargs["content_variables"] = json.dumps({"1": first, "2": body})
        else:
            kwargs["body"] = body
    else:
        kwargs["from_"] = settings.twilio_sms_number or settings.twilio_phone_number
        kwargs["to"] = to
        kwargs["body"] = body
    row["from_number"] = kwargs["from_"]

    try:
        msg = _twilio().messages.create(**kwargs)
        row.update(provider_sid=msg.sid, status="sent")
    except Exception as e:
        log.warning("send to %s failed: %s", to, e)
        row.update(status="failed", error=str(e)[:500])
    saved = db.get_supabase().table("messages").insert(row).execute().data
    return saved[0] if saved else row


def try_send(candidate_id: str, body: str, purpose: str) -> None:
    """Best-effort automatic message; never breaks the caller."""
    if not channel_available():
        return
    try:
        send(candidate_id, body, purpose)
    except Exception as e:
        log.info("automatic %s message skipped for %s: %s", purpose, candidate_id, e)


# ── Automatic touchpoints ────────────────────────────────────────────────

def company_name(candidate: dict) -> str:
    if candidate.get("org_id"):
        try:
            return db.get_supabase().table("organizations").select("name").eq(
                "id", candidate["org_id"]).single().execute().data["name"]
        except Exception:
            pass
    return settings.hr_company_name


def missed_call(candidate_id: str, call_type: str) -> None:
    c = db.get_candidate(candidate_id) or {}
    first = (c.get("name") or "there").split(" ")[0]
    job = (c.get("jobs") or {}).get("title") or "your application"
    what = {"screening": f"a quick chat about {job}", "scheduling": "your interview time",
            "reminder": "your interview today", "result": "your interview outcome"}.get(call_type, job)
    from app.routers.portal import ensure_token, portal_link
    link = portal_link(ensure_token(candidate_id))
    try_send(candidate_id, (
        f"Hi {first}, this is Neha from {company_name(c)}. I just tried calling you about {what}. "
        f"Reply CALL and I'll ring you right now, or pick a time here: {link}"
    ), "missed_call")


def booked(candidate_id: str, slot_label: str, meet_link: str | None) -> None:
    c = db.get_candidate(candidate_id) or {}
    first = (c.get("name") or "there").split(" ")[0]
    link = f" Join here: {meet_link}" if meet_link else ""
    try_send(candidate_id, f"Hi {first}, your interview is booked for {slot_label}.{link} Reply here if anything changes.",
             "booking")


# ── Inbound ─────────────────────────────────────────────────────────────

REPLY_PROMPT = """You are Neha, an AI recruiter for {company}, replying on WhatsApp to {name}.
Their application: {job}. Where they are: {status}.
Recent conversation (oldest first):
{history}

Write a short, warm reply (1-3 sentences, no markdown). Never share scores or feedback.
If they want to talk now (e.g. "CALL", "call me"), set action "call_now".
If they want to reschedule, withdraw, or ask something you can't answer from the facts above,
set action "request" with kind reschedule | withdraw | question and a one-line details.
Reply with ONLY JSON: {{"reply": str, "action": "none" | "call_now" | "request", "kind": str|null, "details": str|null}}
"""

STAGE_TEXT = {
    "new": "application received, screening call pending", "screening": "screening call in progress",
    "screened": "screened, team reviewing", "shortlisted": "shortlisted, scheduling next",
    "scheduling": "interview being scheduled", "scheduled": "interview booked",
    "interviewing": "in interview rounds", "offer": "offer stage", "joined": "joined",
    "rejected": "not moving forward", "withdrawn": "withdrawn",
}


def _find_candidate(phone: str) -> dict | None:
    from app.routers.agent import _find_candidate_by_phone
    found = _find_candidate_by_phone(phone)
    return db.get_candidate(found["id"]) if found else None


async def handle_inbound(from_raw: str, to_raw: str, body: str, sid: str) -> str | None:
    """Store an inbound message and return Neha's reply text (sent by the caller)."""
    channel = "whatsapp" if from_raw.startswith("whatsapp:") else "sms"
    phone = from_raw.replace("whatsapp:", "")
    candidate = _find_candidate(phone)
    supabase = db.get_supabase()
    row = {
        "candidate_id": candidate["id"] if candidate else None, "channel": channel, "direction": "inbound",
        "body": body, "author": "candidate", "from_number": phone, "to_number": to_raw.replace("whatsapp:", ""),
        "provider_sid": sid, "status": "received", "purpose": "reply",
    }
    if candidate and candidate.get("org_id"):
        row["org_id"] = candidate["org_id"]
    try:
        supabase.table("messages").insert(row).execute()
    except Exception as e:  # duplicate webhook delivery
        if "duplicate" in str(e).lower():
            return None
        raise

    if not candidate:
        return "Hi! This is Neha, an AI recruiting assistant. I couldn't find your application from this number. Please reply with your full name and the role you applied for."

    if body.strip().lower() in STOP_WORDS:
        supabase.table("candidates").update({"messaging_opt_out": True}).eq("id", candidate["id"]).execute()
        return "Done, you won't get more messages from us here. Reply START to turn them back on."
    if body.strip().lower() == "start":
        supabase.table("candidates").update({"messaging_opt_out": False}).eq("id", candidate["id"]).execute()
        return "Welcome back! You'll get updates here again."

    history_rows = supabase.table("messages").select("direction, body").eq(
        "candidate_id", candidate["id"]).order("created_at", desc=True).limit(8).execute().data or []
    history = "\n".join(
        f"{'Candidate' if m['direction'] == 'inbound' else 'Neha'}: {m['body']}" for m in reversed(history_rows)
    )
    from app.services.ai_conversation import call_claude
    from app.services.intake import _json_from

    raw = await call_claude(
        system="You write short WhatsApp replies for a recruiting assistant. Output JSON only.",
        messages=[{"role": "user", "content": REPLY_PROMPT.format(
            company=company_name(candidate), name=(candidate.get("name") or "the candidate").split(" ")[0],
            job=(candidate.get("jobs") or {}).get("title") or "an open role",
            status=STAGE_TEXT.get(candidate.get("stage") or "new", "in progress"),
            history=history,
        )}],
        max_tokens=300,
    )
    decision = _json_from(raw) or {}
    reply = (decision.get("reply") or "").strip() or "Thanks! A recruiter will get back to you shortly."

    if decision.get("action") == "call_now":
        from app.workers.queue import enqueue
        call_type = "screening" if candidate.get("stage") in ("new", "screening") else (
            "scheduling" if candidate.get("stage") in ("shortlisted", "scheduling") else "screening")
        enqueue("call.initiate", {"candidate_id": candidate["id"], "call_type": call_type,
                                  "ignore_calling_hours": True},   # they asked for it
                delay_seconds=20, dedupe_key=f"wa-call:{sid}")
    elif decision.get("action") == "request":
        kind = decision.get("kind") if decision.get("kind") in ("reschedule", "withdraw", "question") else "question"
        req = {"candidate_id": candidate["id"], "kind": kind, "details": decision.get("details") or body,
               "caller_number": phone}
        if candidate.get("org_id"):
            req["org_id"] = candidate["org_id"]
        supabase.table("candidate_requests").insert(req).execute()

    supabase.table("candidates").update({"last_contact_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", candidate["id"]).execute()
    return reply
