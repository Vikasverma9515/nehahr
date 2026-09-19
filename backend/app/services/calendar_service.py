"""Google Calendar integration — OAuth, FreeBusy, event creation.

All Google Calendar API calls go through httpx directly. We don't use
google-api-python-client to avoid pulling in a heavy dependency tree
just for three endpoints.
"""

import base64
from datetime import datetime, timedelta, timezone
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.services import db

# OAuth scopes:
#   - calendar.events: create interview events on the interviewer's calendar
#   - calendar.readonly: read FreeBusy to find open slots
#   - gmail.send: send the booking confirmation email
#   - userinfo.email: read the authenticated user's email so we can save the
#     correct address on the hr_sender row after HR OAuth completes
GOOGLE_SCOPES = (
    "https://www.googleapis.com/auth/calendar.events "
    "https://www.googleapis.com/auth/calendar.readonly "
    "https://www.googleapis.com/auth/gmail.send "
    "https://www.googleapis.com/auth/userinfo.email "
    "https://www.googleapis.com/auth/userinfo.profile"
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"
GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


# ============================================================
# OAuth flow
# ============================================================

def build_auth_url(interviewer_id: str) -> str:
    """Build the Google consent URL. State param carries the interviewer_id so
    we know who to save the tokens for in the callback."""
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.backend_url}/api/auth/google/callback",
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": interviewer_id,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def build_hr_auth_url() -> str:
    """Build the Google consent URL for the dedicated HR sender account.

    State is the literal string 'hr:sender' so the OAuth callback knows to
    write the tokens to the hr_sender singleton table instead of updating an
    interviewer row.
    """
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.backend_url}/api/auth/google/callback",
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": "hr:sender",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange an OAuth authorization code for access + refresh tokens."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.backend_url}/api/auth/google/callback",
            },
        )
        response.raise_for_status()
        return response.json()


async def fetch_google_user_info(access_token: str) -> dict | None:
    """Fetch the Google user's email + name using the userinfo endpoint.

    Used right after OAuth token exchange to discover which email the user
    authenticated as — needed to save the hr_sender row with the correct
    address, and to sanity-check interviewer connections.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code != 200:
                print(f"[OAUTH] userinfo failed: {response.status_code} {response.text[:200]}")
                return None
            return response.json()
    except Exception as e:
        print(f"[OAUTH] userinfo exception: {e}")
        return None


async def refresh_access_token(refresh_token: str) -> dict:
    """Use a refresh token to get a new access token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_valid_access_token(interviewer_id: str) -> str | None:
    """Return a valid access token for the given interviewer, refreshing if needed."""
    supabase = db.get_supabase()
    result = supabase.table("interviewers").select(
        "google_refresh_token, google_access_token, google_access_token_expires_at"
    ).eq("id", interviewer_id).single().execute()

    if not result.data:
        return None

    row = result.data
    refresh_token = row.get("google_refresh_token")
    access_token = row.get("google_access_token")
    expires_at_str = row.get("google_access_token_expires_at")

    if not refresh_token:
        return None

    # Check if current access token is still valid (5-min buffer)
    now = datetime.now(timezone.utc)
    if access_token and expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if expires_at > now + timedelta(minutes=5):
            return access_token

    # Refresh
    try:
        token_data = await refresh_access_token(refresh_token)
    except Exception as e:
        print(f"[CALENDAR] Token refresh failed for {interviewer_id}: {e}")
        return None

    new_access_token = token_data.get("access_token")
    expires_in = token_data.get("expires_in", 3600)
    new_expires_at = (now + timedelta(seconds=expires_in)).isoformat()

    supabase.table("interviewers").update({
        "google_access_token": new_access_token,
        "google_access_token_expires_at": new_expires_at,
    }).eq("id", interviewer_id).execute()

    return new_access_token


async def get_hr_sender() -> dict | None:
    """Return the HR sender row (singleton) or None if not connected."""
    supabase = db.get_supabase()
    try:
        result = (
            supabase.table("hr_sender")
            .select("name, email, google_refresh_token, google_access_token, google_access_token_expires_at, connected_at")
            .eq("id", 1)
            .limit(1)
            .execute()
        )
    except Exception as e:
        print(f"[HR_SENDER] Failed to query hr_sender: {e}")
        return None
    if not result.data:
        return None
    return result.data[0]


async def get_hr_access_token() -> tuple[str | None, str | None, str | None]:
    """Return (access_token, hr_email, hr_name) for the HR sender account.

    Refreshes the token if it's within 5 minutes of expiry. Returns (None, None, None)
    if no HR account is connected or the refresh fails — callers should fall
    back to using the interviewer's token.
    """
    row = await get_hr_sender()
    if not row:
        return None, None, None

    refresh_token = row.get("google_refresh_token")
    access_token = row.get("google_access_token")
    expires_at_str = row.get("google_access_token_expires_at")
    hr_email = row.get("email")
    hr_name = row.get("name")

    if not refresh_token or not hr_email:
        return None, None, None

    now = datetime.now(timezone.utc)
    if access_token and expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if expires_at > now + timedelta(minutes=5):
            return access_token, hr_email, hr_name

    # Refresh
    try:
        token_data = await refresh_access_token(refresh_token)
    except Exception as e:
        print(f"[HR_SENDER] Token refresh failed: {e}")
        return None, None, None

    new_access_token = token_data.get("access_token")
    expires_in = token_data.get("expires_in", 3600)
    new_expires_at = (now + timedelta(seconds=expires_in)).isoformat()

    supabase = db.get_supabase()
    supabase.table("hr_sender").update({
        "google_access_token": new_access_token,
        "google_access_token_expires_at": new_expires_at,
    }).eq("id", 1).execute()

    return new_access_token, hr_email, hr_name


# ============================================================
# FreeBusy / availability
# ============================================================

async def get_available_slots(
    interviewer_id: str,
    duration_minutes: int = 60,
    num_slots: int = 10,
    days_ahead: int = 7,
) -> list[dict]:
    """Find available interview slots spread across multiple days.

    Strategy: for each business day in the lookahead window, try to offer one
    morning slot (~10–11 AM) and one afternoon slot (~2–3 PM). This gives the
    candidate day-and-time variety instead of stacking everything on day 1.

    Returns a list of dicts like:
    [
      {"start": "2026-04-15T10:00:00+05:30", "end": "2026-04-15T11:00:00+05:30",
       "label": "Tuesday, April 15 at 10 AM", "day": "Tuesday, April 15",
       "time": "10 AM"},
      ...
    ]
    """
    access_token = await get_valid_access_token(interviewer_id)
    if not access_token:
        print(f"[CALENDAR] No access token for interviewer {interviewer_id}")
        return []

    # Load interviewer config
    supabase = db.get_supabase()
    interviewer = supabase.table("interviewers").select(
        "email, timezone, working_hours_start, working_hours_end"
    ).eq("id", interviewer_id).single().execute()

    if not interviewer.data:
        return []

    email = interviewer.data["email"]
    tz_name = interviewer.data["timezone"]
    work_start = interviewer.data["working_hours_start"]
    work_end = interviewer.data["working_hours_end"]

    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz)

    # Query from tomorrow morning to avoid same-day confusion
    range_start = (now_local + timedelta(days=1)).replace(hour=work_start, minute=0, second=0, microsecond=0)
    range_end = range_start + timedelta(days=days_ahead)

    # FreeBusy API call
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GOOGLE_FREEBUSY_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "timeMin": range_start.isoformat(),
                    "timeMax": range_end.isoformat(),
                    "timeZone": tz_name,
                    "items": [{"id": email}],
                },
            )
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        print(f"[CALENDAR] FreeBusy query failed: {e}")
        return []

    busy_periods = data.get("calendars", {}).get(email, {}).get("busy", [])
    # Parse busy periods into (start, end) tuples
    busy = []
    for period in busy_periods:
        try:
            s = datetime.fromisoformat(period["start"].replace("Z", "+00:00")).astimezone(tz)
            e = datetime.fromisoformat(period["end"].replace("Z", "+00:00")).astimezone(tz)
            busy.append((s, e))
        except Exception:
            continue

    def _slot_is_free(start: datetime, duration: int) -> bool:
        """Check a specific slot against busy periods + working hours."""
        end = start + timedelta(minutes=duration)
        # Must stay inside working hours
        if start.hour < work_start:
            return False
        if end.hour > work_end or (end.hour == work_end and end.minute > 0):
            return False
        # Not overlapping any busy block
        return not any(not (end <= b_start or start >= b_end) for b_start, b_end in busy)

    def _find_slot_in_window(day: datetime, window_start_hour: int, window_end_hour: int) -> datetime | None:
        """Find the earliest free slot in a given hour window on a given day.

        Scans in 30-min increments. Returns None if nothing free.
        """
        candidate = day.replace(hour=window_start_hour, minute=0, second=0, microsecond=0)
        window_end = day.replace(hour=window_end_hour, minute=0, second=0, microsecond=0)
        while candidate + timedelta(minutes=duration_minutes) <= window_end:
            if _slot_is_free(candidate, duration_minutes):
                return candidate
            candidate += timedelta(minutes=30)
        return None

    # Walk days and try to pick one morning + one afternoon slot per day
    # Morning window: work_start → min(12, work_end)
    # Afternoon window: max(13, work_start) → work_end
    morning_end = min(12, work_end)
    afternoon_start = max(13, work_start)

    slots: list[dict] = []
    day = range_start.replace(hour=0, minute=0, second=0, microsecond=0)
    for _ in range(days_ahead):
        if len(slots) >= num_slots:
            break
        # Skip weekends
        if day.weekday() < 5:
            # Morning pick
            if morning_end > work_start and len(slots) < num_slots:
                pick = _find_slot_in_window(day, work_start, morning_end)
                if pick:
                    slot_end = pick + timedelta(minutes=duration_minutes)
                    slots.append({
                        "start": pick.isoformat(),
                        "end": slot_end.isoformat(),
                        "label": _format_slot_label(pick),
                        "day": pick.strftime("%A, %B %-d"),
                        "time": _format_time_only(pick),
                        "period": "morning",
                    })
            # Afternoon pick
            if afternoon_start < work_end and len(slots) < num_slots:
                pick = _find_slot_in_window(day, afternoon_start, work_end)
                if pick:
                    slot_end = pick + timedelta(minutes=duration_minutes)
                    slots.append({
                        "start": pick.isoformat(),
                        "end": slot_end.isoformat(),
                        "label": _format_slot_label(pick),
                        "day": pick.strftime("%A, %B %-d"),
                        "time": _format_time_only(pick),
                        "period": "afternoon",
                    })
        day += timedelta(days=1)

    return slots


def _format_time_only(dt: datetime) -> str:
    """Just the time portion, e.g. '10 AM' or '2:30 PM'."""
    hour = dt.hour
    minute = dt.minute
    if hour == 0:
        return f"12{':' + str(minute).zfill(2) if minute else ''} AM"
    if hour < 12:
        return f"{hour}{':' + str(minute).zfill(2) if minute else ''} AM"
    if hour == 12:
        return f"12{':' + str(minute).zfill(2) if minute else ''} PM"
    return f"{hour - 12}{':' + str(minute).zfill(2) if minute else ''} PM"


def _format_slot_label(dt: datetime) -> str:
    """Human-friendly slot label for Claude to read aloud."""
    day = dt.strftime("%A, %B %-d")
    hour = dt.hour
    minute = dt.minute

    if hour == 0:
        time_str = f"12{':' + str(minute).zfill(2) if minute else ''} AM"
    elif hour < 12:
        time_str = f"{hour}{':' + str(minute).zfill(2) if minute else ''} AM"
    elif hour == 12:
        time_str = f"12{':' + str(minute).zfill(2) if minute else ''} PM"
    else:
        time_str = f"{hour - 12}{':' + str(minute).zfill(2) if minute else ''} PM"

    return f"{day} at {time_str}"


# ============================================================
# Event creation
# ============================================================

async def create_interview_event(
    interviewer_id: str,
    start_iso: str,
    end_iso: str,
    candidate_name: str,
    candidate_email: str | None,
    job_title: str,
    interview_type: str = "video",
    notes: str | None = None,
) -> dict | None:
    """Create a Google Calendar event on the interviewer's calendar.

    - Auto-generates a Google Meet link for video interviews
    - Adds candidate as attendee (Google sends invite automatically)
    - Returns {event_id, meet_link, html_link}
    """
    access_token = await get_valid_access_token(interviewer_id)
    if not access_token:
        return None

    supabase = db.get_supabase()
    interviewer = supabase.table("interviewers").select("name, timezone").eq("id", interviewer_id).single().execute()
    if not interviewer.data:
        return None

    tz_name = interviewer.data["timezone"]
    interviewer_name = interviewer.data["name"]

    description_lines = [
        f"Interview with {candidate_name}"
        + (f" ({candidate_email})" if candidate_email else "")
        + f" for {job_title}",
        "",
        "Scheduled automatically by Neha HR Agent.",
        "The candidate has been sent a separate branded email with the meeting link.",
    ]
    if notes:
        description_lines.append("")
        description_lines.append(notes)

    # Calendar event is created only on the interviewer's calendar with NO
    # attendees. We bypass Google Calendar's own invite email (which looks
    # like a personal invite from an "unknown sender") and instead send a
    # fully branded HR email from our own code path. The candidate gets a
    # professional email with a .ics attachment they can add to any calendar.
    attendees: list[dict] = []

    event_body: dict = {
        "summary": f"Interview: {candidate_name} — {job_title}",
        "description": "\n".join(description_lines),
        "start": {"dateTime": start_iso, "timeZone": tz_name},
        "end": {"dateTime": end_iso, "timeZone": tz_name},
        "attendees": attendees,
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }

    # Add Google Meet link for video interviews
    if interview_type == "video":
        event_body["conferenceData"] = {
            "createRequest": {
                "requestId": f"neha-{interviewer_id[:8]}-{start_iso[:10]}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }

    # Create event with conferenceData. We explicitly set sendUpdates=none so
    # Google Calendar does NOT send its own invite email — we handle all
    # candidate/interviewer notification via a branded HR email instead.
    url = f"{GOOGLE_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=none"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_body,
            )
            if response.status_code >= 400:
                print(f"[CALENDAR] Event creation failed: {response.status_code}")
                print(f"[CALENDAR] Response body: {response.text[:500]}")
                return None
            data = response.json()
    except Exception as e:
        print(f"[CALENDAR] Event creation exception: {e}")
        return None

    meet_link = None
    entry_points = data.get("conferenceData", {}).get("entryPoints", [])
    for ep in entry_points:
        if ep.get("entryPointType") == "video":
            meet_link = ep.get("uri")
            break

    # Log attendee invite delivery so we can debug email issues
    returned_attendees = data.get("attendees", [])
    for att in returned_attendees:
        print(
            f"[CALENDAR] Attendee {att.get('email')} → "
            f"responseStatus={att.get('responseStatus')} "
            f"organizer={att.get('organizer', False)} "
            f"self={att.get('self', False)}"
        )
    print(
        f"[CALENDAR] Event created: {data.get('id')} | "
        f"organizer={data.get('organizer', {}).get('email')} | "
        f"meet={meet_link} | sendUpdates=none (branded email handles notification)"
    )

    return {
        "event_id": data.get("id"),
        "meet_link": meet_link,
        "html_link": data.get("htmlLink"),
        "interviewer_name": interviewer_name,
        "attendees": returned_attendees,
    }


async def delete_interview_event(
    interviewer_id: str,
    event_id: str,
) -> bool:
    """Delete a previously created calendar event on the interviewer's calendar.

    Returns True if deleted (or already gone), False on hard failure.
    sendUpdates=none because we send a separate branded cancellation email.
    """
    if not event_id:
        return True  # nothing to delete

    access_token = await get_valid_access_token(interviewer_id)
    if not access_token:
        print(f"[CALENDAR] Cannot delete event {event_id} — no access token for interviewer {interviewer_id}")
        return False

    url = f"{GOOGLE_EVENTS_URL}/{event_id}?sendUpdates=none"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.delete(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except Exception as e:
        print(f"[CALENDAR] Event delete exception: {e}")
        return False

    # 204 = deleted, 410 = already deleted (Gone) — both fine
    if response.status_code in (204, 410):
        print(f"[CALENDAR] Event {event_id} deleted (status={response.status_code})")
        return True
    if response.status_code == 404:
        print(f"[CALENDAR] Event {event_id} not found (already deleted)")
        return True

    print(f"[CALENDAR] Event delete failed: {response.status_code} {response.text[:300]}")
    return False


# ============================================================
# Gmail API — booking confirmation emails
# ============================================================

def _format_ics_dt(iso_str: str) -> str:
    """Convert an ISO-8601 datetime with offset to an iCal UTC timestamp (YYYYMMDDTHHMMSSZ)."""
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.strftime("%Y%m%dT%H%M%SZ")


def _build_ics(
    uid: str,
    summary: str,
    description: str,
    location: str,
    start_iso: str,
    end_iso: str,
    organizer_name: str,
    organizer_email: str,
    attendee_name: str | None,
    attendee_email: str | None,
) -> str:
    """Build an RFC 5545 iCalendar REQUEST body the recipient can import."""
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    # iCal requires escaping of , ; \ and newlines in TEXT fields
    def esc(s: str) -> str:
        return (
            s.replace("\\", "\\\\")
             .replace(",", "\\,")
             .replace(";", "\\;")
             .replace("\n", "\\n")
        )

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Neha//HR Agent//EN",
        "METHOD:REQUEST",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{now_stamp}",
        f"DTSTART:{_format_ics_dt(start_iso)}",
        f"DTEND:{_format_ics_dt(end_iso)}",
        f"SUMMARY:{esc(summary)}",
        f"DESCRIPTION:{esc(description)}",
        f"LOCATION:{esc(location)}",
        f"URL:{location}",
        f"ORGANIZER;CN={esc(organizer_name)}:mailto:{organizer_email}",
    ]
    if attendee_email:
        lines.append(
            f"ATTENDEE;CN={esc(attendee_name or attendee_email)};"
            "RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:"
            f"mailto:{attendee_email}"
        )
    lines += [
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Interview reminder",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    # iCal requires CRLF line endings
    return "\r\n".join(lines) + "\r\n"


_BRAND_COLOR = "#6366f1"
_INK = "#1a1a1a"
_MUTED = "#6b6b78"
_BG = "#f5f5fa"
_BORDER = "#e8e8f0"


def _email_shell(title_html: str, preheader: str, body_html: str) -> str:
    """Common HTML wrapper — header bar, brand, body slot, footer."""
    company = settings.hr_company_name
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title_html}</title>
</head>
<body style="margin:0; padding:0; background:{_BG}; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; color:{_INK}; -webkit-font-smoothing:antialiased;">
  <!-- preheader (hidden, shows as preview text in inbox) -->
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BG}; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(20,20,40,0.05);">
        <!-- brand bar -->
        <tr><td style="background:{_BRAND_COLOR}; padding:20px 32px;">
          <table role="presentation" width="100%"><tr>
            <td style="color:#ffffff; font-size:15px; font-weight:700; letter-spacing:0.02em;">{company} &middot; Recruiting</td>
            <td align="right" style="color:rgba(255,255,255,0.85); font-size:11px; text-transform:uppercase; letter-spacing:0.08em;">Interview Confirmed</td>
          </tr></table>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:36px 32px 24px 32px;">
          {body_html}
        </td></tr>
        <!-- footer -->
        <tr><td style="background:#fafafd; padding:20px 32px; border-top:1px solid {_BORDER};">
          <p style="margin:0; font-size:11px; line-height:1.6; color:{_MUTED};">
            This confirmation was sent by the {company} recruiting team. If you need to reschedule or have questions, reply to this email and a member of our team will follow up.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _detail_row_html(label: str, value: str) -> str:
    return f"""
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid {_BORDER};">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:{_MUTED}; margin-bottom:2px;">{label}</div>
            <div style="font-size:15px; font-weight:600; color:{_INK};">{value}</div>
          </td>
        </tr>"""


def _build_candidate_email_html(
    candidate_name: str,
    job_title: str,
    slot_label: str,
    meet_link: str,
    interview_type: str,
    duration_minutes: int,
) -> str:
    # Deliberately do NOT expose the interviewer's name to the candidate —
    # HR preference. Candidate only sees the role, time, format, and link.
    company = settings.hr_company_name
    pretty_type = interview_type.replace("_", " ").title()
    details = (
        _detail_row_html("Role", job_title)
        + _detail_row_html("Date &amp; time", slot_label)
        + _detail_row_html("Format", f"{pretty_type} &middot; {duration_minutes} minutes")
    )
    body = f"""
          <h1 style="margin:0 0 8px 0; font-size:24px; line-height:1.25; color:{_INK};">You're all set, {candidate_name}.</h1>
          <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:{_MUTED};">
            Thanks for speaking with us. Your interview for the <strong style="color:{_INK};">{job_title}</strong> role at {company} is confirmed.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">{details}
          </table>
          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
            <tr><td align="center">
              <a href="{meet_link}" style="display:inline-block; background:{_BRAND_COLOR}; color:#ffffff; padding:14px 32px; border-radius:10px; text-decoration:none; font-size:15px; font-weight:600; letter-spacing:0.01em;">Join the interview &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px 0; font-size:12px; line-height:1.6; color:{_MUTED}; text-align:center;">
            Or copy this link: <a href="{meet_link}" style="color:{_BRAND_COLOR};">{meet_link}</a>
          </p>
          <!-- Prep checklist -->
          <div style="background:{_BG}; border-radius:12px; padding:20px 24px; margin:0 0 24px 0;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:{_MUTED}; margin-bottom:10px;">Before the call</div>
            <ul style="margin:0; padding-left:18px; font-size:14px; line-height:1.7; color:{_INK};">
              <li>Join 2-3 minutes early to test your camera, mic, and connection.</li>
              <li>Find a quiet, well-lit space with a stable internet connection.</li>
              <li>Keep your resume handy and be ready to walk through recent projects.</li>
              <li>Have a few questions ready &mdash; we love curiosity.</li>
            </ul>
          </div>
          <p style="margin:0; font-size:14px; line-height:1.6; color:{_INK};">
            We've attached a calendar invite (<code style="background:{_BG}; padding:1px 6px; border-radius:4px; font-size:12px;">.ics</code>) to this email &mdash; click it to add the interview to your calendar.
          </p>
          <p style="margin:28px 0 0 0; font-size:14px; line-height:1.6; color:{_INK};">
            Good luck,<br>
            <strong>The {company} Recruiting Team</strong>
          </p>"""
    return _email_shell(
        title_html=f"Interview confirmed &mdash; {job_title}",
        preheader=f"Your {job_title} interview at {company} is confirmed for {slot_label}.",
        body_html=body,
    )


def _build_interviewer_email_html(
    interviewer_name: str,
    candidate_name: str,
    candidate_email: str | None,
    candidate_phone: str | None,
    job_title: str,
    slot_label: str,
    meet_link: str,
    interview_type: str,
    duration_minutes: int,
) -> str:
    company = settings.hr_company_name
    pretty_type = interview_type.replace("_", " ").title()
    contact_bits = []
    if candidate_email:
        contact_bits.append(
            f'<a href="mailto:{candidate_email}" style="color:{_BRAND_COLOR};">{candidate_email}</a>'
        )
    if candidate_phone:
        contact_bits.append(
            f'<a href="tel:{candidate_phone}" style="color:{_BRAND_COLOR};">{candidate_phone}</a>'
        )
    candidate_contact = " &middot; ".join(contact_bits) if contact_bits else "Not provided"

    details = (
        _detail_row_html("Candidate", candidate_name)
        + _detail_row_html("Contact", candidate_contact)
        + _detail_row_html("Role", job_title)
        + _detail_row_html("Date &amp; time", slot_label)
        + _detail_row_html("Format", f"{pretty_type} &middot; {duration_minutes} minutes")
    )
    body = f"""
          <h1 style="margin:0 0 8px 0; font-size:24px; line-height:1.25; color:{_INK};">New interview scheduled</h1>
          <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:{_MUTED};">
            Hi {interviewer_name}, a new interview has been booked on your calendar by Neha, the {company} HR agent.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">{details}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
            <tr><td align="center">
              <a href="{meet_link}" style="display:inline-block; background:{_BRAND_COLOR}; color:#ffffff; padding:14px 32px; border-radius:10px; text-decoration:none; font-size:15px; font-weight:600; letter-spacing:0.01em;">Open Google Meet &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px 0; font-size:12px; line-height:1.6; color:{_MUTED}; text-align:center;">
            <a href="{meet_link}" style="color:{_BRAND_COLOR};">{meet_link}</a>
          </p>
          <div style="background:{_BG}; border-radius:12px; padding:20px 24px; margin:0 0 24px 0;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:{_MUTED}; margin-bottom:10px;">Reminder</div>
            <p style="margin:0; font-size:14px; line-height:1.6; color:{_INK};">
              The candidate has been sent a separate branded confirmation with the same meeting link. The event is on your Google Calendar &mdash; no action needed from you until the interview.
            </p>
          </div>
          <p style="margin:28px 0 0 0; font-size:14px; line-height:1.6; color:{_INK};">
            &mdash; Neha, {company} HR Agent
          </p>"""
    return _email_shell(
        title_html=f"New interview: {candidate_name} &mdash; {job_title}",
        preheader=f"{candidate_name} is booked on your calendar for {slot_label}.",
        body_html=body,
    )


async def _send_via_gmail_api(
    access_token: str,
    sender_display: str,
    sender_email: str,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    ics_body: str,
    ics_filename: str,
    reply_to: str | None = None,
) -> str | None:
    """Assemble an RFC 5322 multipart/mixed email with an .ics attachment and
    send it via Gmail API. Returns the Gmail message id on success."""
    # Outer multipart/mixed so we can attach the .ics file alongside the body
    root = MIMEMultipart("mixed")
    root["From"] = f"{sender_display} <{sender_email}>"
    root["To"] = to_email
    root["Subject"] = subject
    if reply_to:
        root["Reply-To"] = reply_to

    # Inner multipart/alternative for text + html bodies
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    root.attach(alt)

    # .ics attachment — only if provided (booking emails have it, reminder emails don't)
    if ics_body and ics_filename:
        ics_part = MIMEBase("text", "calendar", method="REQUEST", charset="UTF-8")
        ics_part.set_payload(ics_body.encode("utf-8"))
        ics_part.add_header("Content-Transfer-Encoding", "8bit")
        ics_part.add_header(
            "Content-Disposition", f'attachment; filename="{ics_filename}"'
        )
        root.attach(ics_part)

    raw_message = base64.urlsafe_b64encode(root.as_bytes()).decode("ascii")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GMAIL_SEND_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw_message},
            )
            if response.status_code >= 400:
                print(f"[GMAIL] Send failed to {to_email}: {response.status_code}")
                print(f"[GMAIL] Response body: {response.text[:500]}")
                return None
            data = response.json()
    except Exception as e:
        print(f"[GMAIL] Send exception to {to_email}: {e}")
        return None

    msg_id = data.get("id")
    print(f"[GMAIL] Sent to {to_email} | id={msg_id} | subject={subject!r}")
    return msg_id


async def send_booking_email(
    interviewer_id: str,
    candidate_name: str,
    candidate_email: str | None,
    job_title: str,
    slot: dict,
    meet_link: str,
    interview_type: str = "video",
    duration_minutes: int = 60,
) -> bool:
    """Send two separate branded booking emails: one to the candidate and one
    to the interviewer, each with an .ics calendar attachment.

    Sender priority:
      1. Dedicated HR sender account (hr_sender table) — preferred. Emails
         genuinely come from the HR recruiting address, not the interviewer.
      2. Fallback: the interviewer's own Gmail OAuth, with the HR display name
         overridden in the From header.

    Returns True if at least one email sent successfully.
    """
    # Always load interviewer info — we need it for the interviewer-facing
    # email regardless of which account does the actual sending.
    supabase = db.get_supabase()
    interviewer_result = (
        supabase.table("interviewers")
        .select("name, email")
        .eq("id", interviewer_id)
        .single()
        .execute()
    )
    if not interviewer_result.data:
        print(f"[GMAIL] Interviewer {interviewer_id} not found")
        return False

    interviewer_name = interviewer_result.data.get("name") or "the hiring manager"
    interviewer_email = interviewer_result.data.get("email")
    if not interviewer_email:
        print(f"[GMAIL] Interviewer {interviewer_id} has no email")
        return False

    # Prefer the HR sender account if connected. Otherwise fall back to the
    # interviewer's own Gmail OAuth.
    hr_access_token, hr_email, hr_name_from_db = await get_hr_access_token()
    if hr_access_token and hr_email:
        access_token = hr_access_token
        sender_email = hr_email
        sender_source = "hr_sender"
        print(f"[GMAIL] Using HR sender account: {hr_email}")
    else:
        access_token = await get_valid_access_token(interviewer_id)
        if not access_token:
            print(f"[GMAIL] No access token for interviewer {interviewer_id} (and no HR sender)")
            return False
        sender_email = interviewer_email
        sender_source = "interviewer_fallback"
        print(f"[GMAIL] No HR sender connected — falling back to interviewer Gmail ({interviewer_email})")

    # Candidate phone — best-effort lookup so the interviewer email can include
    # it. Not fatal if missing.
    candidate_phone = None
    if candidate_email:
        try:
            cand_row = (
                supabase.table("candidates")
                .select("phone")
                .eq("email", candidate_email)
                .limit(1)
                .execute()
            )
            if cand_row.data:
                candidate_phone = cand_row.data[0].get("phone")
        except Exception:
            pass

    slot_label = slot.get("label", "your scheduled time")
    slot_start = slot.get("start")
    slot_end = slot.get("end")
    if not (slot_start and slot_end):
        print("[GMAIL] Slot missing start/end ISO, cannot build ICS")
        return False

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"
    reply_to = settings.hr_reply_to or None

    # Build the shared ICS bits
    ics_uid = f"{slot_start}-{interviewer_id}@example.com"
    ics_description = (
        f"Interview for {job_title} at {company}.\\n"
        f"Candidate: {candidate_name}\\n"
        f"Meeting link: {meet_link}"
    )

    # -- Candidate email ----------------------------------------------------
    candidate_sent = False
    if candidate_email:
        cand_html = _build_candidate_email_html(
            candidate_name=candidate_name,
            job_title=job_title,
            slot_label=slot_label,
            meet_link=meet_link,
            interview_type=interview_type,
            duration_minutes=duration_minutes,
        )
        cand_text = (
            f"Hi {candidate_name},\n\n"
            f"Your interview for {job_title} at {company} is confirmed.\n\n"
            f"When: {slot_label}\n"
            f"Format: {interview_type.replace('_', ' ').title()} ({duration_minutes} min)\n"
            f"Join link: {meet_link}\n\n"
            f"Please join 2-3 minutes early to test your setup. Reply to this email if you need to reschedule.\n\n"
            f"Good luck,\nThe {company} Recruiting Team"
        )
        cand_ics = _build_ics(
            uid=ics_uid,
            summary=f"Interview: {job_title} @ {company}",
            description=ics_description,
            location=meet_link,
            start_iso=slot_start,
            end_iso=slot_end,
            organizer_name=sender_display,
            organizer_email=sender_email,
            attendee_name=candidate_name,
            attendee_email=candidate_email,
        )
        msg_id = await _send_via_gmail_api(
            access_token=access_token,
            sender_display=sender_display,
            sender_email=sender_email,
            to_email=candidate_email,
            subject=f"Your {job_title} interview at {company} is confirmed — {slot_label}",
            html_body=cand_html,
            text_body=cand_text,
            ics_body=cand_ics,
            ics_filename="interview.ics",
            reply_to=reply_to,
        )
        candidate_sent = msg_id is not None
    else:
        print("[GMAIL] No candidate email — skipping candidate confirmation")

    # -- Interviewer email --------------------------------------------------
    int_html = _build_interviewer_email_html(
        interviewer_name=interviewer_name,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        job_title=job_title,
        slot_label=slot_label,
        meet_link=meet_link,
        interview_type=interview_type,
        duration_minutes=duration_minutes,
    )
    int_text = (
        f"Hi {interviewer_name},\n\n"
        f"A new interview has been scheduled on your calendar.\n\n"
        f"Candidate: {candidate_name}\n"
        f"Contact: {candidate_email or '-'}{(' / ' + candidate_phone) if candidate_phone else ''}\n"
        f"Role: {job_title}\n"
        f"When: {slot_label}\n"
        f"Format: {interview_type.replace('_', ' ').title()} ({duration_minutes} min)\n"
        f"Join link: {meet_link}\n\n"
        f"— Neha, {company} HR Agent"
    )
    int_ics = _build_ics(
        uid=ics_uid + "-int",
        summary=f"Interview: {candidate_name} — {job_title}",
        description=ics_description,
        location=meet_link,
        start_iso=slot_start,
        end_iso=slot_end,
        organizer_name=sender_display,
        organizer_email=sender_email,
        attendee_name=interviewer_name,
        attendee_email=interviewer_email,
    )
    int_msg_id = await _send_via_gmail_api(
        access_token=access_token,
        sender_display=sender_display,
        sender_email=sender_email,
        to_email=interviewer_email,
        subject=f"New interview: {candidate_name} — {job_title} ({slot_label})",
        html_body=int_html,
        text_body=int_text,
        ics_body=int_ics,
        ics_filename="interview.ics",
        reply_to=reply_to,
    )
    interviewer_sent = int_msg_id is not None

    if candidate_sent or interviewer_sent:
        print(
            f"[GMAIL] Booking emails dispatched via {sender_source} "
            f"(from={sender_email}, candidate={'ok' if candidate_sent else 'skip'}, "
            f"interviewer={'ok' if interviewer_sent else 'fail'})"
        )
        return True

    print("[GMAIL] No booking emails sent (both failed)")
    return False


# ============================================================
# Cancellation emails
# ============================================================

def _build_cancellation_html(
    recipient_name: str,
    role: str,  # "candidate" or "interviewer"
    other_party_name: str,
    job_title: str,
    slot_label: str,
    reason: str | None,
    reschedule: bool,
) -> str:
    """HTML body for a cancellation email. Works for candidate + interviewer
    by flipping the pronouns."""
    company = settings.hr_company_name

    if role == "candidate":
        headline = "Your interview has been cancelled"
        # Candidate copy intentionally does NOT mention the interviewer by name.
        context = (
            f"We need to cancel your <strong>{job_title}</strong> interview "
            f"that was scheduled for <strong>{slot_label}</strong>."
        )
        next_step = (
            "Our team will reach out shortly to get a new time on your calendar."
            if reschedule
            else "If you have any questions about next steps, reply to this email and we'll get back to you."
        )
    else:
        headline = "Interview cancelled"
        context = (
            f"The <strong>{job_title}</strong> interview with "
            f"<strong>{other_party_name}</strong> scheduled for "
            f"<strong>{slot_label}</strong> has been cancelled. "
            "The event has been removed from your calendar."
        )
        next_step = (
            "The recruiting team is coordinating a new time and will send you a fresh invite."
            if reschedule
            else "No further action needed from your side."
        )

    reason_block = ""
    if reason:
        safe_reason = reason.replace("<", "&lt;").replace(">", "&gt;")
        reason_block = (
            f"<tr><td style='padding:16px 20px; background:#fafafd; "
            f"border-radius:10px; border:1px solid {_BORDER};'>"
            f"<p style='margin:0 0 4px 0; font-size:10px; text-transform:uppercase; "
            f"letter-spacing:0.12em; color:{_MUTED}; font-weight:700;'>Reason</p>"
            f"<p style='margin:0; font-size:14px; line-height:1.55; color:{_INK};'>{safe_reason}</p>"
            f"</td></tr><tr><td style='height:20px;'></td></tr>"
        )

    body_html = f"""
<h1 style="margin:0 0 8px 0; font-size:22px; line-height:1.3; color:{_INK}; font-weight:700;">{headline}</h1>
<p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:{_MUTED};">Hi {recipient_name},</p>

<p style="margin:0 0 20px 0; font-size:15px; line-height:1.65; color:{_INK};">{context}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{reason_block}
</table>

<p style="margin:0 0 24px 0; font-size:14px; line-height:1.65; color:{_INK};">{next_step}</p>

<p style="margin:0; font-size:13px; color:{_MUTED};">Thank you for your understanding,<br><strong style="color:{_INK};">{company} Recruiting Team</strong></p>
"""

    # Reuse the shell but swap the "Interview Confirmed" tag to "Cancelled"
    shell = _email_shell(
        title_html=headline,
        preheader=f"{job_title} interview cancelled — {slot_label}",
        body_html=body_html,
    )
    return shell.replace("Interview Confirmed", "Interview Cancelled")


async def send_cancellation_email(
    interviewer_id: str,
    candidate_name: str,
    candidate_email: str | None,
    job_title: str,
    slot_label: str,
    reason: str | None = None,
    reschedule: bool = True,
) -> bool:
    """Send cancellation emails to both candidate and interviewer.

    - `reason`: optional HR-provided reason (shown verbatim in the email).
    - `reschedule`: if True, email says "we'll reach out to reschedule". If
      False, email says "no further action needed".
    Returns True if at least one email sent.
    """
    supabase = db.get_supabase()
    interviewer_result = (
        supabase.table("interviewers")
        .select("name, email")
        .eq("id", interviewer_id)
        .single()
        .execute()
    )
    if not interviewer_result.data:
        print(f"[GMAIL] Interviewer {interviewer_id} not found for cancellation")
        return False

    interviewer_name = interviewer_result.data.get("name") or "the hiring manager"
    interviewer_email = interviewer_result.data.get("email")

    # Sender: prefer HR sender, fall back to interviewer's Gmail
    hr_access_token, hr_email, _ = await get_hr_access_token()
    if hr_access_token and hr_email:
        access_token = hr_access_token
        sender_email = hr_email
    else:
        access_token = await get_valid_access_token(interviewer_id)
        if not access_token:
            print(f"[GMAIL] No access token for cancellation email")
            return False
        sender_email = interviewer_email

    company = settings.hr_company_name
    sender_display = settings.hr_sender_name or f"{company} Recruiting"

    # -- Candidate email ---------------------------------------------------
    candidate_sent = False
    if candidate_email:
        cand_html = _build_cancellation_html(
            recipient_name=candidate_name,
            role="candidate",
            other_party_name=interviewer_name,
            job_title=job_title,
            slot_label=slot_label,
            reason=reason,
            reschedule=reschedule,
        )
        cand_text = (
            f"Hi {candidate_name},\n\n"
            f"Your {job_title} interview scheduled for {slot_label} has been cancelled.\n\n"
            + (f"Reason: {reason}\n\n" if reason else "")
            + ("Our team will reach out shortly to reschedule.\n\n" if reschedule
               else "If you have any questions, please reply to this email.\n\n")
            + f"Thank you,\n{company} Recruiting Team"
        )
        msg_id = await _send_via_gmail_api(
            access_token=access_token,
            sender_display=sender_display,
            sender_email=sender_email or interviewer_email,
            to_email=candidate_email,
            subject=f"Your {job_title} interview has been cancelled — {slot_label}",
            html_body=cand_html,
            text_body=cand_text,
            ics_body="",
            ics_filename="",
        )
        candidate_sent = msg_id is not None

    # -- Interviewer email -------------------------------------------------
    interviewer_sent = False
    if interviewer_email:
        int_html = _build_cancellation_html(
            recipient_name=interviewer_name,
            role="interviewer",
            other_party_name=candidate_name,
            job_title=job_title,
            slot_label=slot_label,
            reason=reason,
            reschedule=reschedule,
        )
        int_text = (
            f"Hi {interviewer_name},\n\n"
            f"The {job_title} interview with {candidate_name} scheduled for "
            f"{slot_label} has been cancelled. The calendar event has been removed.\n\n"
            + (f"Reason: {reason}\n\n" if reason else "")
            + ("The recruiting team will send a new invite once rescheduled.\n\n" if reschedule
               else "No further action needed.\n\n")
            + f"— {company} Recruiting"
        )
        int_msg_id = await _send_via_gmail_api(
            access_token=access_token,
            sender_display=sender_display,
            sender_email=sender_email or interviewer_email,
            to_email=interviewer_email,
            subject=f"Cancelled: {candidate_name} — {job_title} ({slot_label})",
            html_body=int_html,
            text_body=int_text,
            ics_body="",
            ics_filename="",
        )
        interviewer_sent = int_msg_id is not None

    if candidate_sent or interviewer_sent:
        print(
            f"[GMAIL] Cancellation emails dispatched "
            f"(candidate={'ok' if candidate_sent else 'skip/fail'}, "
            f"interviewer={'ok' if interviewer_sent else 'skip/fail'})"
        )
        return True

    print("[GMAIL] No cancellation emails sent (both failed)")
    return False
