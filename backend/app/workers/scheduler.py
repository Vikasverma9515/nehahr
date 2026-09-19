"""Background scheduler — runs inside the FastAPI process.

Wakes up every 5 minutes and checks for:
1. Interviews in ~2 hours: reminder call to candidate + summary email to interviewer
2. Interviews with submitted feedback: auto-trigger result call
3. Feedback overdue (>2h after interview marked complete): nudge interviewer

No external dependency — uses plain asyncio.sleep in a background task.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.services import db
from app.services.call_service import call_service

INTERVAL_SECONDS = 300  # 5 minutes


async def _check_reminders():
    """Find interviews happening in ~2 hours.

    For each:
    - Trigger a reminder call to the CANDIDATE (via Twilio)
    - Send a summary email to the INTERVIEWER (via Gmail API)
    """
    supabase = db.get_supabase()
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=1, minutes=30)
    window_end = now + timedelta(hours=2, minutes=30)

    result = supabase.table("interviews").select(
        "id, candidate_id, interviewer_id, scheduled_at, interview_type, "
        "duration_minutes, meeting_link, interviewer_reminded, "
        "candidates(name, phone, email, score, current_location, "
        "  employment_status, current_ctc, expected_ctc, notice_period_days), "
        "jobs(title, required_skills), "
        "interviewers(name, email)"
    ).eq("status", "scheduled").eq(
        "candidate_reminded", False
    ).gte(
        "scheduled_at", window_start.isoformat()
    ).lte(
        "scheduled_at", window_end.isoformat()
    ).execute()

    for iv in result.data or []:
        candidate = iv.get("candidates") or {}
        job = iv.get("jobs") or {}
        interviewer = iv.get("interviewers") or {}
        scheduled_at = iv.get("scheduled_at", "")

        try:
            from zoneinfo import ZoneInfo
            dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
            local_dt = dt.astimezone(ZoneInfo("Asia/Kolkata"))
            time_str = f"today at {local_dt.strftime('%-I:%M %p')}"
        except Exception:
            time_str = "today"

        # ── 1. Reminder call to candidate ──────────────────────────
        phone = candidate.get("phone")
        if phone:
            print(f"[SCHEDULER] Reminder call → {candidate.get('name')} — interview {time_str}")
            try:
                call_service.initiate_call(
                    candidate_id=iv["candidate_id"],
                    call_type="reminder",
                )
            except Exception as e:
                print(f"[SCHEDULER] Reminder call failed: {e}")

        # Mark candidate as reminded
        supabase.table("interviews").update({
            "candidate_reminded": True,
        }).eq("id", iv["id"]).execute()

        # ── 2. Summary email to interviewer ────────────────────────
        interviewer_email = interviewer.get("email")
        interviewer_name = interviewer.get("name", "")
        if interviewer_email and not iv.get("interviewer_reminded"):
            try:
                await _send_interviewer_summary_email(
                    interviewer_id=iv.get("interviewer_id"),
                    interviewer_name=interviewer_name,
                    interviewer_email=interviewer_email,
                    candidate=candidate,
                    job=job,
                    interview_time=time_str,
                    interview_type=iv.get("interview_type", "video"),
                    duration_minutes=iv.get("duration_minutes", 60),
                    meeting_link=iv.get("meeting_link"),
                )
                supabase.table("interviews").update({
                    "interviewer_reminded": True,
                }).eq("id", iv["id"]).execute()
            except Exception as e:
                print(f"[SCHEDULER] Interviewer email failed: {e}")


async def _send_interviewer_summary_email(
    interviewer_id: str,
    interviewer_name: str,
    interviewer_email: str,
    candidate: dict,
    job: dict,
    interview_time: str,
    interview_type: str,
    duration_minutes: int,
    meeting_link: str | None,
):
    """Send a pre-interview candidate summary email to the interviewer.

    Per the spec: includes candidate name, role, current/expected CTC,
    skills, screening highlights, and HR contact info.
    """
    from app.services.calendar_service import (
        get_hr_access_token,
        get_valid_access_token,
        _send_via_gmail_api,
    )

    # Get sender token (prefer HR sender, fall back to interviewer)
    access_token, sender_email, _ = await get_hr_access_token()
    if not access_token and interviewer_id:
        access_token = await get_valid_access_token(interviewer_id)
        sender_email = interviewer_email
    if not access_token:
        print(f"[SCHEDULER] No Gmail token available for interviewer summary email")
        return

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"
    cand_name = candidate.get("name", "Candidate")
    job_title = job.get("title", "the role")
    cand_email = candidate.get("email", "")
    cand_phone = candidate.get("phone", "")
    score = candidate.get("score")
    location = candidate.get("current_location", "")
    employment = candidate.get("employment_status", "")
    notice = candidate.get("notice_period_days")
    current_ctc = candidate.get("current_ctc")
    expected_ctc = candidate.get("expected_ctc")
    skills = job.get("required_skills") or []

    def fmt_ctc(ctc: dict | None) -> str:
        if not ctc or not isinstance(ctc, dict):
            return "Not provided"
        if ctc.get("min") and ctc.get("max"):
            return f"{ctc['min']}–{ctc['max']} LPA"
        parts = []
        if ctc.get("fixed"):
            parts.append(f"{ctc['fixed']}L fixed")
        if ctc.get("variable"):
            parts.append(f"{ctc['variable']}L variable")
        return " + ".join(parts) if parts else "Not provided"

    subject = f"Interview today: {cand_name} — {job_title} ({interview_time})"

    text_body = f"""Hi {interviewer_name},

You have an interview coming up {interview_time}.

CANDIDATE SUMMARY
Name: {cand_name}
Role: {job_title}
Contact: {cand_email} / {cand_phone}
Location: {location or 'Not provided'}
Employment: {employment or 'Not provided'}
Notice Period: {f'{notice} days' if notice else 'Not provided'}
Current CTC: {fmt_ctc(current_ctc)}
Expected CTC: {fmt_ctc(expected_ctc)}
Screening Score: {f'{score}%' if score else 'Not scored'}
Key Skills: {', '.join(skills) if skills else 'See JD'}

Format: {interview_type.replace('_', ' ').title()} · {duration_minutes} min
{f'Join link: {meeting_link}' if meeting_link else ''}

Should you have any queries about this candidate, please connect with the HR team.

— {company} Recruiting"""

    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1a1a1a; max-width:600px; margin:0 auto; padding:24px;">
<h2 style="color:#333; margin:0 0 4px 0;">Interview {interview_time}</h2>
<p style="margin:0 0 20px 0; color:#666;">{cand_name} — {job_title}</p>

<table style="width:100%; border-collapse:collapse; margin:0 0 20px 0;">
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888; width:140px;">Candidate</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:600;">{cand_name}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Contact</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">{cand_email}{f' · {cand_phone}' if cand_phone else ''}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Location</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">{location or '—'}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Employment</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; text-transform:capitalize;">{employment or '—'}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Notice Period</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">{f'{notice} days' if notice else '—'}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Current CTC</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">{fmt_ctc(current_ctc)}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Expected CTC</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:600;">{fmt_ctc(expected_ctc)}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Screening Score</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:600;">{f'{score}%' if score else '—'}</td></tr>
  <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#888;">Key Skills</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">{', '.join(skills) if skills else 'See JD'}</td></tr>
  <tr><td style="padding:8px 0; color:#888;">Format</td>
      <td style="padding:8px 0;">{interview_type.replace('_', ' ').title()} · {duration_minutes} min</td></tr>
</table>

{f'<p><a href="{meeting_link}" style="display:inline-block; background:#333; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:600;">Join Meeting</a></p>' if meeting_link else ''}

<p style="color:#888; font-size:13px; margin-top:24px;">
Should you have any queries about this candidate ahead of the interview, please connect with the HR team.
</p>
<hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
<p style="color:#aaa; font-size:11px;">Sent by {company} Recruiting · Powered by Neha AI</p>
</body></html>"""

    msg_id = await _send_via_gmail_api(
        access_token=access_token,
        sender_display=sender_display,
        sender_email=sender_email or interviewer_email,
        to_email=interviewer_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        ics_body="",  # No ICS needed — interviewer already has the calendar event
        ics_filename="",
    )
    if msg_id:
        print(f"[SCHEDULER] Interviewer summary email sent to {interviewer_email}")
    else:
        print(f"[SCHEDULER] Failed to send interviewer summary email")


async def _check_result_calls():
    """Result communication is now fully HR-led (email, not auto-call).

    Per spec: "Final selection call → Human HR only."
    HR uses the "Send Email" button on the dashboard to send pass/fail/hold
    emails with editable templates. No auto-calls for any result.

    This function is kept as a no-op placeholder in case we add auto-
    notifications later (e.g., auto-email for rejections).
    """
    pass


async def _check_overdue_feedback():
    """Find interviews completed >2 hours ago with no feedback submitted.

    Updates feedback_status to 'overdue' so the UI can show a warning.
    In a future iteration, this could also send a reminder email to the
    interviewer.
    """
    supabase = db.get_supabase()
    two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()

    # Find completed interviews where feedback was requested but not submitted,
    # and the interview was marked complete more than 2 hours ago.
    result = supabase.table("interviews").select(
        "id, interviewer_id, feedback_token, interviewers(name, email), candidates(name), jobs(title)"
    ).eq("status", "completed").eq(
        "feedback_status", "requested"
    ).lte(
        "scheduled_at", two_hours_ago
    ).execute()

    for iv in result.data or []:
        interviewer = iv.get("interviewers") or {}
        candidate = iv.get("candidates") or {}
        job = iv.get("jobs") or {}

        # Mark as overdue
        supabase.table("interviews").update({
            "feedback_status": "overdue",
        }).eq("id", iv["id"]).execute()

        print(
            f"[SCHEDULER] Feedback overdue: {interviewer.get('name', '?')} "
            f"hasn't submitted feedback for {candidate.get('name', '?')} "
            f"({job.get('title', '?')})"
        )

        # Send reminder email to interviewer with the feedback link
        interviewer_email = interviewer.get("email")
        interviewer_name = interviewer.get("name", "")
        token = iv.get("feedback_token")
        if interviewer_email and token:
            try:
                await _send_feedback_reminder_email(
                    interviewer_id=iv.get("interviewer_id"),
                    interviewer_name=interviewer_name,
                    interviewer_email=interviewer_email,
                    candidate_name=candidate.get("name", "the candidate"),
                    job_title=job.get("title", "the role"),
                    token=token,
                )
            except Exception as e:
                print(f"[SCHEDULER] Feedback reminder email failed: {e}")


async def _send_feedback_reminder_email(
    interviewer_id: str | None,
    interviewer_name: str,
    interviewer_email: str,
    candidate_name: str,
    job_title: str,
    token: str,
):
    """Send a nudge email to the interviewer asking them to submit feedback."""
    from app.services.calendar_service import (
        get_hr_access_token,
        get_valid_access_token,
        _send_via_gmail_api,
    )

    access_token, sender_email, _ = await get_hr_access_token()
    if not access_token and interviewer_id:
        access_token = await get_valid_access_token(interviewer_id)
        sender_email = interviewer_email
    if not access_token:
        return

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"
    feedback_url = f"{settings.frontend_url}/feedback/{token}"

    subject = f"Reminder: Please submit feedback for {candidate_name} — {job_title}"

    text_body = f"""Hi {interviewer_name},

This is a friendly reminder to submit your interview feedback for {candidate_name} ({job_title}).

Your feedback helps us move quickly on hiring decisions. Please submit it:
{feedback_url}

No login required — just click the link.

Thank you,
{company} Recruiting"""

    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto; padding:24px;">
<h2 style="margin:0 0 8px 0; color:#333;">Feedback reminder</h2>
<p>Hi {interviewer_name},</p>
<p>Your interview with <strong>{candidate_name}</strong> for <strong>{job_title}</strong> was completed over 2 hours ago, and we haven't received your feedback yet.</p>
<p>Your input is critical for making a timely hiring decision. It takes under 2 minutes:</p>
<p><a href="{feedback_url}" style="display:inline-block; background:#333; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600;">Submit Feedback</a></p>
<p style="color:#888; font-size:13px;">No login required — this link is unique to your interview.</p>
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
    print(f"[SCHEDULER] Feedback reminder sent to {interviewer_email}")


async def _check_pre_joining():
    """Auto-trigger pre-joining calls based on joining date.

    Track A (short-notice, joining within 7 days):
      → Trigger pre-joining call 1-2 days before joining
      → Also: if 48h post-offer and no response, proactively reach out

    Track B (long-notice, joining > 14 days away):
      → Trigger engagement call every 2-3 weeks
      → Final pre-joining call 1-2 days before joining (switches to Track A)
    """
    supabase = db.get_supabase()
    now = datetime.now(timezone.utc)
    today = now.date()

    # Find candidates in offer/pre_joining stage with a joining_date set
    result = supabase.table("candidates").select(
        "id, name, phone, joining_date, stage, pre_joining_status, "
        "last_engagement_call_at, engagement_score, jobs(title)"
    ).in_(
        "stage", ["offer", "pre_joining"]
    ).not_.is_(
        "joining_date", "null"
    ).neq(
        "pre_joining_status", "dropped"
    ).execute()

    for c in result.data or []:
        phone = c.get("phone")
        if not phone:
            continue

        joining_date_str = c.get("joining_date")
        if not joining_date_str:
            continue

        try:
            from datetime import date as date_type
            if isinstance(joining_date_str, str):
                joining_date = date_type.fromisoformat(joining_date_str)
            else:
                joining_date = joining_date_str
        except Exception:
            continue

        days_until = (joining_date - today).days
        last_call = c.get("last_engagement_call_at")
        last_call_date = None
        if last_call:
            try:
                last_call_date = datetime.fromisoformat(last_call.replace("Z", "+00:00")).date()
            except Exception:
                pass

        # Skip if we already called today
        if last_call_date and last_call_date >= today:
            continue

        job = c.get("jobs") or {}

        # ── Track A: 1-2 days before joining ──
        if 0 <= days_until <= 2:
            print(f"[SCHEDULER] Track A: pre-joining call → {c.get('name')} (joining in {days_until} days)")
            try:
                call_service.initiate_call(
                    candidate_id=c["id"],
                    call_type="pre_joining",
                )
                # Move to pre_joining stage if still in offer
                if c.get("stage") == "offer":
                    supabase.table("candidates").update({
                        "stage": "pre_joining",
                    }).eq("id", c["id"]).execute()
            except Exception as e:
                print(f"[SCHEDULER] Track A call failed: {e}")

        # ── Track B: every 2-3 weeks for long-notice candidates ──
        elif days_until > 14:
            days_since_last = (today - last_call_date).days if last_call_date else 999
            if days_since_last >= 14:  # 2 weeks since last engagement call
                print(f"[SCHEDULER] Track B: engagement call → {c.get('name')} (joining in {days_until} days, last call {days_since_last}d ago)")
                try:
                    call_service.initiate_call(
                        candidate_id=c["id"],
                        call_type="engagement",
                    )
                    if c.get("stage") == "offer":
                        supabase.table("candidates").update({
                            "stage": "pre_joining",
                        }).eq("id", c["id"]).execute()
                except Exception as e:
                    print(f"[SCHEDULER] Track B call failed: {e}")

        # ── 48h post-offer silent dropout detection ──
        elif days_until > 2 and not last_call:
            # Never been called after offer — check if offer was > 48h ago
            offer_at = c.get("offer_accepted_at")
            if offer_at:
                try:
                    offer_dt = datetime.fromisoformat(offer_at.replace("Z", "+00:00"))
                    hours_since_offer = (now - offer_dt).total_seconds() / 3600
                    if hours_since_offer >= 48:
                        print(f"[SCHEDULER] Dropout check: {c.get('name')} — 48h+ since offer, no contact")
                        call_service.initiate_call(
                            candidate_id=c["id"],
                            call_type="pre_joining",
                        )
                except Exception as e:
                    print(f"[SCHEDULER] Dropout check failed: {e}")


async def run_scheduler():
    """Main scheduler loop. Runs forever inside the FastAPI process."""
    print("[SCHEDULER] Background scheduler started (interval: 5 min)")
    while True:
        try:
            await _check_reminders()
            await _check_result_calls()
            await _check_overdue_feedback()
            await _check_pre_joining()
        except Exception as e:
            print(f"[SCHEDULER] Tick error: {e}")
        await asyncio.sleep(INTERVAL_SECONDS)
