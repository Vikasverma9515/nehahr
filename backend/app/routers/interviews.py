"""Interview scheduling API.

Flow:
1. HR calls GET /api/interviews/slots?candidate_id=X → backend returns 3 free slots
2. HR calls POST /api/interviews/schedule-call → backend triggers Neha to call candidate
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.services import db
from app.services import calendar_service
from app.services.call_service import call_service
from app.services.tenancy import scope

# ── Email templates ────────────────────────────────────────────────────

def _generate_email_template(
    result: str,
    candidate_name: str,
    job_title: str,
    company: str,
) -> dict:
    """Generate a pre-filled email subject + body based on interview result.

    HR can edit these before sending.
    """
    if result == "pass":
        return {
            "subject": f"Great news regarding your {job_title} application — {company}",
            "body": f"""Hi {candidate_name},

Thank you for taking the time to interview with us for the {job_title} role at {company}. We were impressed with your background and how you approached the conversation.

We're happy to share that the team would like to move forward with your candidacy. A member of our HR team will be reaching out to you shortly to discuss the next steps, including offer details and timelines.

In the meantime, please don't hesitate to reach out if you have any questions.

Looking forward to having you on board.

Best regards,
{company} Recruiting Team""",
        }
    elif result == "fail":
        return {
            "subject": f"Update on your {job_title} application — {company}",
            "body": f"""Hi {candidate_name},

Thank you for taking the time to interview with us for the {job_title} role at {company}. We genuinely appreciate the effort you put into the process.

After careful consideration, the team has decided to move forward with other candidates whose experience more closely aligns with what we're looking for at this time.

This was not an easy decision, and we want you to know that your profile left a positive impression. We'd encourage you to keep an eye on our openings — we'd love to stay connected for future opportunities that may be a better fit.

We wish you all the best in your career ahead.

Warm regards,
{company} Recruiting Team""",
        }
    else:  # hold
        return {
            "subject": f"Update on your {job_title} interview — {company}",
            "body": f"""Hi {candidate_name},

Thank you for interviewing with us for the {job_title} role at {company}. We appreciate the time you invested in the process.

We wanted to let you know that we're still finalizing our decision and expect to have an update for you within the next few days. We haven't forgotten about you — the team is being thoughtful about this.

Please bear with us, and feel free to reach out if you have any questions in the meantime.

Best regards,
{company} Recruiting Team""",
        }

router = APIRouter()
# Token-authenticated endpoints for interviewers without an account.
public_router = APIRouter()


@router.get("/")
async def list_interviews(status: str | None = None, limit: int = 50):
    """List interviews, optionally filtered by status."""
    supabase = db.get_supabase()
    query = (
        scope(supabase.table("interviews")
        .select("*, candidates(name, phone, email), jobs(title), interviewers(name, email)"))
        .order("scheduled_at", desc=False)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return {"interviews": result.data, "total": len(result.data or [])}


@router.get("/{interview_id}")
async def get_interview(interview_id: str):
    """Get a single interview with all related data."""
    supabase = db.get_supabase()
    result = (
        supabase.table("interviews")
        .select("*, candidates(name, phone, email, score), jobs(title, department), interviewers(name, email)")
        .eq("id", interview_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    return result.data


@router.get("/slots/preview")
async def get_slots_preview(
    candidate_id: str = Query(...),
    interviewer_id: str | None = Query(None),
    duration_minutes: int = Query(60),
):
    """Fetch 3 available slots for HR to preview before triggering the scheduling call.

    If interviewer_id is not provided, falls back to the job's default_interviewer_id.
    """
    supabase = db.get_supabase()

    # Load candidate and job
    candidate_result = (
        supabase.table("candidates")
        .select("id, name, phone, email, job_id, jobs(title, default_interviewer_id, default_interview_type, default_interview_duration_minutes)")
        .eq("id", candidate_id)
        .single()
        .execute()
    )
    if not candidate_result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = candidate_result.data
    job = candidate.get("jobs") or {}

    # Resolve interviewer
    if not interviewer_id:
        interviewer_id = job.get("default_interviewer_id")
    if not interviewer_id:
        raise HTTPException(
            status_code=400,
            detail="No interviewer specified and no default interviewer on the job. "
            "Set a default interviewer on the job or pass interviewer_id.",
        )

    # Use job's default duration if not passed
    if duration_minutes == 60 and job.get("default_interview_duration_minutes"):
        duration_minutes = job["default_interview_duration_minutes"]

    slots = await calendar_service.get_available_slots(
        interviewer_id=interviewer_id,
        duration_minutes=duration_minutes,
        num_slots=10,
        days_ahead=7,
    )

    # Load interviewer name for display
    interviewer_result = supabase.table("interviewers").select("name, email").eq("id", interviewer_id).single().execute()
    interviewer_info = interviewer_result.data or {}

    return {
        "candidate": {
            "id": candidate["id"],
            "name": candidate["name"],
            "phone": candidate["phone"],
        },
        "job_title": job.get("title", ""),
        "interviewer": {
            "id": interviewer_id,
            "name": interviewer_info.get("name", ""),
            "email": interviewer_info.get("email", ""),
        },
        "interview_type": job.get("default_interview_type", "video"),
        "duration_minutes": duration_minutes,
        "slots": slots,
    }


class TriggerSchedulingRequest(BaseModel):
    candidate_id: str
    interviewer_id: str | None = None
    interview_type: str | None = None
    selected_slots: list[dict] | None = None  # HR-curated slots from the modal
    duration_minutes: int | None = None


@router.post("/trigger-scheduling-call")
async def trigger_scheduling_call(req: TriggerSchedulingRequest):
    """HR clicks 'Schedule Interview' → this endpoint triggers Neha to call the candidate.

    We:
    1. Fetch slots for the interviewer (Google Calendar FreeBusy)
    2. Create a pending interviews row with offered_slots
    3. Kick off a Twilio call with call_type=scheduling
    4. The call handler reads the offered_slots from the interviews row and feeds them to Claude
    """
    supabase = db.get_supabase()

    candidate_result = (
        supabase.table("candidates")
        .select("id, name, phone, email, job_id, stage, jobs(title, default_interviewer_id, default_interview_type, default_interview_duration_minutes)")
        .eq("id", req.candidate_id)
        .single()
        .execute()
    )
    if not candidate_result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = candidate_result.data
    job = candidate.get("jobs") or {}

    # Spec: scheduling only happens after HR has shortlisted
    if candidate["stage"] not in ("shortlisted", "scheduling"):
        raise HTTPException(
            status_code=400,
            detail=f"Candidate must be shortlisted before scheduling. Current stage: {candidate['stage']}",
        )

    interviewer_id = req.interviewer_id or job.get("default_interviewer_id")
    if not interviewer_id:
        raise HTTPException(
            status_code=400,
            detail="No interviewer specified. Set a default interviewer on the job or pass interviewer_id.",
        )

    interview_type = req.interview_type or job.get("default_interview_type", "video")
    duration = req.duration_minutes or job.get("default_interview_duration_minutes", 60)

    # 1. Use HR-curated slots if provided, otherwise fetch from calendar
    if req.selected_slots and len(req.selected_slots) > 0:
        slots = req.selected_slots
    else:
        slots = await calendar_service.get_available_slots(
            interviewer_id=interviewer_id,
            duration_minutes=duration,
            num_slots=10,
            days_ahead=7,
        )

    if not slots:
        raise HTTPException(
            status_code=400,
            detail="No available slots found. "
            "Please check interviewer's calendar or pick a different interviewer.",
        )

    # 2. Figure out which round this is. Look at how many rounds the
    # candidate has already passed — if they passed Round N, this is Round N+1.
    # Cancelled or failed rounds don't advance the count.
    passed_rows = (
        supabase.table("interviews")
        .select("round_number")
        .eq("candidate_id", candidate["id"])
        .eq("result", "pass")
        .execute()
    )
    passed_rounds = [r.get("round_number") or 1 for r in (passed_rows.data or [])]
    next_round = (max(passed_rounds) + 1) if passed_rounds else 1

    # 3. Create pending interview row (status=scheduled, result=pending)
    # We'll update this row when the candidate confirms a slot via voice
    interview_row = supabase.table("interviews").insert({
        "candidate_id": candidate["id"],
        "job_id": candidate.get("job_id"),
        "interviewer_id": interviewer_id,
        "interview_type": interview_type,
        "duration_minutes": duration,
        "status": "scheduled",
        "offered_slots": slots,
        "round_number": next_round,
    }).execute()

    interview_id = interview_row.data[0]["id"] if interview_row.data else None

    # 3. Move candidate to 'scheduling' stage so HR sees the call is in progress
    # Also clear any prior manual-scheduling flag — this is a fresh attempt.
    supabase.table("candidates").update({
        "stage": "scheduling",
        "needs_manual_scheduling": False,
        "scheduling_notes": None,
        "last_contact_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", candidate["id"]).execute()

    # 4. Kick off the Twilio call
    try:
        call_result = call_service.initiate_call(
            candidate_id=candidate["id"],
            call_type="scheduling",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {e}")

    # Link the interview to the call
    if interview_id and call_result.get("call_id"):
        supabase.table("interviews").update({
            "scheduling_call_id": call_result["call_id"],
        }).eq("id", interview_id).execute()

    return {
        "interview_id": interview_id,
        "call_id": call_result.get("call_id"),
        "status": "initiated",
        "slots_offered": len(slots),
    }


async def _handle_post_feedback(
    interview_id: str,
    candidate_id: str,
    result: str,
    round_number: int,
):
    """Shared logic after feedback is submitted.

    HR is always in the loop between rounds — the system records the
    interviewer's recommendation but never auto-schedules the next round.

    - fail → rejected (interviewer explicitly said no; stage update matches)
    - hold → stays in interviewing; HR decides later
    - pass + more rounds remain → candidate goes back to 'shortlisted' with a
      clear note so HR can review feedback and click Schedule Round N+1
    - pass + final round → candidate moves to 'offer' stage (HR sends offer)
    """
    supabase = db.get_supabase()

    if result == "fail":
        supabase.table("candidates").update({"stage": "rejected"}).eq("id", candidate_id).execute()
        return {"next_action": "rejected"}

    if result == "hold":
        return {"next_action": "hold"}

    # result == "pass" — check if more rounds
    candidate_row = (
        supabase.table("candidates")
        .select("job_id, jobs(total_interview_rounds)")
        .eq("id", candidate_id)
        .single()
        .execute()
    )
    job = (candidate_row.data.get("jobs") or {}) if candidate_row.data else {}
    total_rounds = job.get("total_interview_rounds", 1)

    if round_number < total_rounds:
        # HR decides whether (and when) to advance. We just set a clear flag
        # on the candidate so the UI can render the right action.
        next_round = round_number + 1
        supabase.table("candidates").update({
            "stage": "shortlisted",
            "scheduling_notes": (
                f"Passed Round {round_number}. "
                f"HR to review feedback and decide on Round {next_round}."
            ),
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", candidate_id).execute()
        print(f"[MULTI-ROUND] Round {round_number} passed — HR decides on Round {next_round}")
        return {"next_action": "hr_decides_next_round", "round": next_round}
    else:
        # Final round passed — move to offer
        supabase.table("candidates").update({"stage": "offer"}).eq("id", candidate_id).execute()
        return {"next_action": "offer"}


class FeedbackPayload(BaseModel):
    """Structured feedback from the interviewer after the interview."""
    technical_skills: int  # 1-5
    communication: int  # 1-5
    culture_fit: int  # 1-5
    overall: int  # 1-5
    recommendation: str  # strong_yes / yes / maybe / no / strong_no
    strengths: str = ""
    concerns: str = ""
    notes: str = ""
    result: str  # pass / fail / hold


class MarkCompletePayload(BaseModel):
    """HR marks an interview as completed (happened)."""
    pass


@router.post("/{interview_id}/complete")
async def mark_interview_completed(interview_id: str):
    """HR marks interview as completed.

    1. Sets status=completed, feedback_status=requested
    2. Generates a unique feedback_token
    3. Sends the feedback link email to the interviewer
    4. Moves candidate to 'interviewing' stage
    """
    supabase = db.get_supabase()
    row = (
        supabase.table("interviews")
        .select("id, status, candidate_id, interviewer_id, interviewers(name, email), candidates(name), jobs(title)")
        .eq("id", interview_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    if row.data["status"] not in ("scheduled", "confirmed", "in_progress"):
        raise HTTPException(status_code=400, detail=f"Cannot complete interview in '{row.data['status']}' status")

    # Generate unique token for the feedback form link
    token = secrets.token_urlsafe(32)

    supabase.table("interviews").update({
        "status": "completed",
        "feedback_status": "requested",
        "feedback_token": token,
    }).eq("id", interview_id).execute()

    # Move candidate stage
    candidate_id = row.data.get("candidate_id")
    if candidate_id:
        supabase.table("candidates").update({"stage": "interviewing"}).eq("id", candidate_id).execute()

    # Send feedback request email to interviewer
    interviewer = row.data.get("interviewers") or {}
    candidate = row.data.get("candidates") or {}
    job = row.data.get("jobs") or {}
    interviewer_email = interviewer.get("email")
    interviewer_name = interviewer.get("name", "")

    if interviewer_email and row.data.get("interviewer_id"):
        try:
            await _send_feedback_request_email(
                interviewer_id=row.data["interviewer_id"],
                interviewer_name=interviewer_name,
                interviewer_email=interviewer_email,
                candidate_name=candidate.get("name", "the candidate"),
                job_title=job.get("title", "the role"),
                token=token,
            )
        except Exception as e:
            print(f"[INTERVIEWS] Feedback email failed: {e}")

    return {"status": "completed", "feedback_status": "requested", "feedback_token": token}


async def _send_feedback_request_email(
    interviewer_id: str,
    interviewer_name: str,
    interviewer_email: str,
    candidate_name: str,
    job_title: str,
    token: str,
):
    """Send the feedback form link to the interviewer after interview completes."""
    from app.services.calendar_service import (
        get_hr_access_token,
        get_valid_access_token,
        _send_via_gmail_api,
    )

    access_token, sender_email, _ = await get_hr_access_token()
    if not access_token:
        access_token = await get_valid_access_token(interviewer_id)
        sender_email = interviewer_email
    if not access_token:
        print("[INTERVIEWS] No Gmail token for feedback email")
        return

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"
    feedback_url = f"{settings.frontend_url}/feedback/{token}"

    subject = f"Please submit feedback: {candidate_name} — {job_title}"

    text_body = f"""Hi {interviewer_name},

Thank you for interviewing {candidate_name} for the {job_title} role.

Please take a moment to submit your feedback — it helps the team make a quick hiring decision.

Submit feedback: {feedback_url}

This link is unique to this interview. No login required.

Thank you,
{company} Recruiting"""

    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto; padding:24px;">
<h2 style="margin:0 0 4px 0; color:#333;">Interview feedback needed</h2>
<p style="margin:0 0 20px 0; color:#666;">{candidate_name} — {job_title}</p>

<p>Hi {interviewer_name},</p>
<p>Thank you for interviewing <strong>{candidate_name}</strong> for the <strong>{job_title}</strong> role.</p>
<p>Please submit your feedback — it takes under 2 minutes and helps the team make a quick hiring decision.</p>

<p style="margin:24px 0;">
  <a href="{feedback_url}" style="display:inline-block; background:#333; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">Submit Feedback</a>
</p>

<p style="color:#888; font-size:13px;">This link is unique to this interview. No login required.</p>
<hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
<p style="color:#aaa; font-size:11px;">Sent by {company} Recruiting</p>
</body></html>"""

    await _send_via_gmail_api(
        access_token=access_token,
        sender_display=sender_display,
        sender_email=sender_email or interviewer_email,
        to_email=interviewer_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        ics_body="",
        ics_filename="",
    )
    print(f"[INTERVIEWS] Feedback request email sent to {interviewer_email} with token {token[:8]}...")


class CancelPayload(BaseModel):
    """HR cancels a scheduled interview (meeting can't happen)."""
    reason: str | None = None
    reschedule: bool = True  # True = reset candidate so HR can pick new slots


@router.post("/{interview_id}/cancel")
async def cancel_interview(interview_id: str, payload: CancelPayload):
    """Cancel a scheduled interview.

    Flow:
    1. Delete the Google Calendar event (if any) from the interviewer's calendar
    2. Mark the interview row as cancelled
    3. Send a branded cancellation email to both the candidate and interviewer
    4. If reschedule=True → reset candidate back to 'shortlisted' so HR can
       schedule again. Otherwise leave the candidate where they are.
    """
    supabase = db.get_supabase()

    row = (
        supabase.table("interviews")
        .select("""
            id, status, candidate_id, interviewer_id, google_event_id,
            scheduled_at, confirmed_slot, interview_type,
            interviewers(name, email),
            candidates(name, email),
            jobs(title)
        """)
        .eq("id", interview_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    current_status = row.data["status"]
    if current_status == "cancelled":
        raise HTTPException(status_code=400, detail="Interview is already cancelled")
    if current_status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed interview")

    interviewer_id = row.data.get("interviewer_id")
    google_event_id = row.data.get("google_event_id")
    candidate_id = row.data.get("candidate_id")
    candidate = row.data.get("candidates") or {}
    job = row.data.get("jobs") or {}
    confirmed_slot = row.data.get("confirmed_slot") or {}

    candidate_name = candidate.get("name", "Candidate")
    candidate_email = candidate.get("email")
    job_title = job.get("title", "the role")
    slot_label = confirmed_slot.get("label") or row.data.get("scheduled_at") or "the scheduled time"

    # 1. Delete the Google Calendar event (best-effort)
    calendar_deleted = True
    if google_event_id and interviewer_id:
        calendar_deleted = await calendar_service.delete_interview_event(
            interviewer_id=interviewer_id,
            event_id=google_event_id,
        )

    # 2. Mark interview cancelled. The interviews table doesn't have a free-text
    # notes column — the reason lives on the candidate row + in the email body.
    reason_note = payload.reason or "Cancelled by HR"
    supabase.table("interviews").update({
        "status": "cancelled",
    }).eq("id", interview_id).execute()

    # 3. Update the candidate row. Always record the reason in scheduling_notes
    # so it shows up in the journey's "Needs HR attention" banner. If we're
    # rescheduling, also reset stage + flag for manual.
    if candidate_id:
        candidate_update: dict = {
            "scheduling_notes": (
                f"Interview cancelled ({reason_note}). Ready to reschedule."
                if payload.reschedule
                else f"Interview cancelled ({reason_note})."
            ),
            "last_contact_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.reschedule:
            candidate_update["stage"] = "shortlisted"
            candidate_update["needs_manual_scheduling"] = True
        supabase.table("candidates").update(candidate_update).eq("id", candidate_id).execute()

    # 4. Send cancellation emails (best-effort)
    email_sent = False
    if interviewer_id:
        try:
            email_sent = await calendar_service.send_cancellation_email(
                interviewer_id=interviewer_id,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                job_title=job_title,
                slot_label=slot_label,
                reason=payload.reason,
                reschedule=payload.reschedule,
            )
        except Exception as e:
            print(f"[INTERVIEWS] Cancellation email failed: {e}")

    return {
        "status": "cancelled",
        "calendar_event_deleted": calendar_deleted,
        "email_sent": email_sent,
        "candidate_reset": payload.reschedule,
    }


@router.post("/{interview_id}/feedback")
async def submit_feedback(interview_id: str, payload: FeedbackPayload):
    """Interviewer submits structured feedback after the interview.

    This also sets the interview result (pass/fail/hold) and updates the
    candidate stage accordingly.
    """
    supabase = db.get_supabase()
    row = supabase.table("interviews").select("id, status, candidate_id").eq("id", interview_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    if row.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Interview must be completed before submitting feedback")

    if payload.recommendation not in ("strong_yes", "yes", "maybe", "no", "strong_no"):
        raise HTTPException(status_code=400, detail="Invalid recommendation value")
    if payload.result not in ("pass", "fail", "hold"):
        raise HTTPException(status_code=400, detail="Invalid result value")
    for field in ("technical_skills", "communication", "culture_fit", "overall"):
        val = getattr(payload, field)
        if not (1 <= val <= 5):
            raise HTTPException(status_code=400, detail=f"{field} must be 1-5")

    feedback_json = payload.model_dump()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Get round_number for multi-round logic
    iv_full = supabase.table("interviews").select("round_number").eq("id", interview_id).single().execute()
    round_number = iv_full.data.get("round_number", 1) if iv_full.data else 1

    supabase.table("interviews").update({
        "feedback": feedback_json,
        "feedback_status": "submitted",
        "feedback_submitted_at": now_iso,
        "result": payload.result,
    }).eq("id", interview_id).execute()

    # Multi-round aware stage update
    candidate_id = row.data.get("candidate_id")
    post_result = {}
    if candidate_id:
        post_result = await _handle_post_feedback(
            interview_id=interview_id,
            candidate_id=candidate_id,
            result=payload.result,
            round_number=round_number,
        )

    return {"status": "feedback_submitted", "result": payload.result, **post_result}


@router.patch("/{interview_id}")
async def update_interview(interview_id: str, payload: dict):
    """Generic patch — used by the call handler to record confirmed slot, Meet link, etc."""
    allowed_fields = {
        "status", "confirmed_slot", "scheduled_at", "meeting_link",
        "google_event_id", "result", "feedback", "feedback_status",
    }
    data = {k: v for k, v in payload.items() if k in allowed_fields}
    if not data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    supabase = db.get_supabase()
    result = supabase.table("interviews").update(data).eq("id", interview_id).execute()
    return result.data[0] if result.data else {}


# =====================================================================
# Public feedback endpoints — no auth, token-based
# =====================================================================

@public_router.get("/feedback-form/{token}")
async def get_feedback_form_data(token: str):
    """Public endpoint — interviewer clicks the email link, frontend fetches
    this to show the form with context (candidate name, job, etc.).

    No authentication required — the token is the auth.
    """
    supabase = db.get_supabase()
    result = (
        supabase.table("interviews")
        .select("id, status, feedback_status, interview_type, scheduled_at, candidates(name), jobs(title)")
        .eq("feedback_token", token)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid or expired feedback link")

    iv = result.data[0]
    if iv["feedback_status"] == "submitted":
        return {"already_submitted": True, "interview_id": iv["id"]}

    candidate = iv.get("candidates") or {}
    job = iv.get("jobs") or {}
    return {
        "already_submitted": False,
        "interview_id": iv["id"],
        "candidate_name": candidate.get("name", "Candidate"),
        "job_title": job.get("title", ""),
        "interview_type": iv.get("interview_type", "video"),
        "scheduled_at": iv.get("scheduled_at"),
    }


@public_router.post("/feedback-form/{token}")
async def submit_feedback_by_token(token: str, payload: FeedbackPayload):
    """Public endpoint — interviewer submits feedback via the token link.

    Same validation as the authenticated endpoint, but uses the token
    instead of interview_id for lookup.
    """
    supabase = db.get_supabase()
    result = (
        supabase.table("interviews")
        .select("id, status, feedback_status, candidate_id")
        .eq("feedback_token", token)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid or expired feedback link")

    iv = result.data[0]
    if iv["feedback_status"] == "submitted":
        raise HTTPException(status_code=400, detail="Feedback already submitted")
    if iv["status"] != "completed":
        raise HTTPException(status_code=400, detail="Interview must be completed first")

    if payload.recommendation not in ("strong_yes", "yes", "maybe", "no", "strong_no"):
        raise HTTPException(status_code=400, detail="Invalid recommendation")
    if payload.result not in ("pass", "fail", "hold"):
        raise HTTPException(status_code=400, detail="Invalid result")
    for field in ("technical_skills", "communication", "culture_fit", "overall"):
        if not (1 <= getattr(payload, field) <= 5):
            raise HTTPException(status_code=400, detail=f"{field} must be 1-5")

    # Get round_number for multi-round logic
    iv_full = supabase.table("interviews").select("round_number").eq("id", iv["id"]).single().execute()
    round_number = iv_full.data.get("round_number", 1) if iv_full.data else 1

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("interviews").update({
        "feedback": payload.model_dump(),
        "feedback_status": "submitted",
        "feedback_submitted_at": now_iso,
        "result": payload.result,
    }).eq("id", iv["id"]).execute()

    # Multi-round aware stage update
    candidate_id = iv.get("candidate_id")
    post_result = {}
    if candidate_id:
        post_result = await _handle_post_feedback(
            interview_id=iv["id"],
            candidate_id=candidate_id,
            result=payload.result,
            round_number=round_number,
        )

    return {"status": "feedback_submitted", "result": payload.result, **post_result}


# =====================================================================
# HR email to candidate — templated, editable, one-click send
# =====================================================================

@router.get("/{interview_id}/email-template")
async def get_email_template(
    interview_id: str,
    as_result: str | None = Query(None, alias="as"),
):
    """Get a pre-filled email template for the interview result.

    HR can override the interviewer's recommendation by passing `?as=pass`,
    `?as=hold`, or `?as=fail` — e.g. to send a rejection email even when
    the interviewer recommended pass. The final hiring decision is HR's.
    """
    supabase = db.get_supabase()
    iv = (
        supabase.table("interviews")
        .select("id, result, candidates(name, email), jobs(title)")
        .eq("id", interview_id)
        .single()
        .execute()
    )
    if not iv.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    # HR override wins over the stored result
    if as_result and as_result in ("pass", "hold", "fail"):
        result_val = as_result
    else:
        result_val = iv.data.get("result")
        if not result_val:
            raise HTTPException(status_code=400, detail="No result set yet")

    candidate = iv.data.get("candidates") or {}
    job = iv.data.get("jobs") or {}
    company = settings.hr_company_name

    template = _generate_email_template(
        result=result_val,
        candidate_name=candidate.get("name", "Candidate"),
        job_title=job.get("title", "the role"),
        company=company,
    )

    return {
        "to_email": candidate.get("email", ""),
        "to_name": candidate.get("name", ""),
        "subject": template["subject"],
        "body": template["body"],
        "result": result_val,
    }


class SendEmailPayload(BaseModel):
    to_email: str
    subject: str
    body: str


@router.post("/{interview_id}/send-email")
async def send_result_email(interview_id: str, payload: SendEmailPayload):
    """HR reviews the template, optionally edits it, and clicks Send."""
    supabase = db.get_supabase()
    iv = (
        supabase.table("interviews")
        .select("id, interviewer_id, result")
        .eq("id", interview_id)
        .single()
        .execute()
    )
    if not iv.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    from app.services.calendar_service import (
        get_hr_access_token,
        get_valid_access_token,
        _send_via_gmail_api,
    )

    interviewer_id = iv.data.get("interviewer_id")
    access_token, sender_email, _ = await get_hr_access_token()
    if not access_token and interviewer_id:
        access_token = await get_valid_access_token(interviewer_id)
        intr = supabase.table("interviewers").select("email").eq("id", interviewer_id).single().execute()
        sender_email = intr.data.get("email") if intr.data else None
    if not access_token or not sender_email:
        raise HTTPException(status_code=500, detail="No Gmail token available")

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"

    # Convert plain text body to HTML paragraphs
    paragraphs = payload.body.split("\n")
    html_lines = []
    for line in paragraphs:
        if line.strip():
            html_lines.append(f"<p style='margin:0 0 12px 0;'>{line}</p>")
        else:
            html_lines.append("<br>")

    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto; padding:24px; line-height:1.6;">
{''.join(html_lines)}
</body></html>"""

    msg_id = await _send_via_gmail_api(
        access_token=access_token,
        sender_display=sender_display,
        sender_email=sender_email,
        to_email=payload.to_email,
        subject=payload.subject,
        html_body=html_body,
        text_body=payload.body,
        ics_body="",
        ics_filename="",
    )

    if not msg_id:
        raise HTTPException(status_code=500, detail="Failed to send email")

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("interviews").update({
        "result_communicated": True,
        "result_communicated_at": now_iso,
    }).eq("id", interview_id).execute()

    print(f"[INTERVIEWS] HR result email sent to {payload.to_email}")
    return {"sent": True, "to": payload.to_email}
