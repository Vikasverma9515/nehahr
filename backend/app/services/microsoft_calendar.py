"""Microsoft 365 / Outlook calendars via Microsoft Graph.

Interviewers on Outlook connect once (OAuth, delegated permissions). Neha
then reads their free/busy with ``getSchedule`` and books interviews as
Outlook events with a Teams meeting link, the same way it does for Google.

App registration (Entra ID): redirect URI
``{BACKEND_URL}/api/auth/microsoft/callback``, delegated permissions
``Calendars.ReadWrite``, ``OnlineMeetings.ReadWrite``, ``User.Read``,
``offline_access``. Set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT
("common" for any organisation).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.services import db

SCOPES = "offline_access User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite"
GRAPH = "https://graph.microsoft.com/v1.0"


def _authority() -> str:
    return f"https://login.microsoftonline.com/{settings.ms_tenant or 'common'}/oauth2/v2.0"


def _redirect() -> str:
    return f"{settings.backend_url}/api/auth/microsoft/callback"


def is_configured() -> bool:
    return bool(settings.ms_client_id and settings.ms_client_secret)


def build_auth_url(interviewer_id: str) -> str:
    from app.services.calendar_service import signed_state
    return f"{_authority()}/authorize?" + urlencode({
        "client_id": settings.ms_client_id,
        "response_type": "code",
        "redirect_uri": _redirect(),
        "response_mode": "query",
        "scope": SCOPES,
        "state": signed_state(f"ms:{interviewer_id}"),
        "prompt": "select_account",
    })


async def _token_request(data: dict) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(f"{_authority()}/token", data={
            "client_id": settings.ms_client_id,
            "client_secret": settings.ms_client_secret,
            "scope": SCOPES,
            **data,
        })
        r.raise_for_status()
        return r.json()


async def connect(interviewer_id: str, code: str) -> None:
    tokens = await _token_request({"grant_type": "authorization_code", "code": code, "redirect_uri": _redirect()})
    now = datetime.now(timezone.utc)
    db.get_supabase().table("interviewers").update({
        "calendar_provider": "microsoft",
        "ms_refresh_token": tokens["refresh_token"],
        "ms_access_token": tokens["access_token"],
        "ms_access_token_expires_at": (now + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat(),
        "ms_connected_at": now.isoformat(),
    }).eq("id", interviewer_id).execute()


async def get_valid_access_token(interviewer_id: str) -> str | None:
    row = db.get_supabase().table("interviewers").select(
        "ms_refresh_token, ms_access_token, ms_access_token_expires_at"
    ).eq("id", interviewer_id).single().execute().data
    if not row or not row.get("ms_refresh_token"):
        return None
    now = datetime.now(timezone.utc)
    exp = row.get("ms_access_token_expires_at")
    if row.get("ms_access_token") and exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) > now + timedelta(minutes=5):
        return row["ms_access_token"]
    try:
        tokens = await _token_request({"grant_type": "refresh_token", "refresh_token": row["ms_refresh_token"]})
    except Exception as e:
        print(f"[MS CALENDAR] refresh failed for {interviewer_id}: {e}")
        return None
    update = {
        "ms_access_token": tokens["access_token"],
        "ms_access_token_expires_at": (now + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat(),
    }
    if tokens.get("refresh_token"):   # Microsoft rotates refresh tokens
        update["ms_refresh_token"] = tokens["refresh_token"]
    db.get_supabase().table("interviewers").update(update).eq("id", interviewer_id).execute()
    return tokens["access_token"]


async def busy(interviewer: dict, start: datetime, end: datetime) -> list[tuple[datetime, datetime]] | None:
    """Busy blocks (UTC) from Outlook. None if we couldn't ask."""
    token = await get_valid_access_token(interviewer["id"])
    if not token:
        return None
    body = {
        "schedules": [interviewer["email"]],
        "startTime": {"dateTime": start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "endTime": {"dateTime": end.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "availabilityViewInterval": 30,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{GRAPH}/me/calendar/getSchedule", json=body, headers={
                "Authorization": f"Bearer {token}", "Prefer": 'outlook.timezone="UTC"'})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        print(f"[MS CALENDAR] getSchedule failed: {e}")
        return None
    blocks: list[tuple[datetime, datetime]] = []
    for sched in data.get("value", []):
        for item in sched.get("scheduleItems", []):
            if item.get("status") in ("free", "workingElsewhere"):
                continue
            s = datetime.fromisoformat(item["start"]["dateTime"][:19]).replace(tzinfo=timezone.utc)
            e = datetime.fromisoformat(item["end"]["dateTime"][:19]).replace(tzinfo=timezone.utc)
            blocks.append((s, e))
    return blocks


async def create_event(interviewer_id: str, *, start_iso: str, end_iso: str, subject: str, body_html: str,
                       attendee_emails: list[str], online: bool) -> dict | None:
    token = await get_valid_access_token(interviewer_id)
    if not token:
        return None
    event = {
        "subject": subject,
        "body": {"contentType": "HTML", "content": body_html},
        "start": {"dateTime": datetime.fromisoformat(start_iso).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "end": {"dateTime": datetime.fromisoformat(end_iso).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "attendees": [{"emailAddress": {"address": a}, "type": "required"} for a in attendee_emails],
        "allowNewTimeProposals": False,
    }
    if online:
        event.update({"isOnlineMeeting": True, "onlineMeetingProvider": "teamsForBusiness"})
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{GRAPH}/me/events", json=event, headers={"Authorization": f"Bearer {token}"})
            if r.status_code >= 400:
                print(f"[MS CALENDAR] event failed: {r.status_code} {r.text[:300]}")
                return None
            data = r.json()
    except Exception as e:
        print(f"[MS CALENDAR] event exception: {e}")
        return None
    return {
        "event_id": data.get("id"),
        "meet_link": (data.get("onlineMeeting") or {}).get("joinUrl"),
        "html_link": data.get("webLink"),
        "provider": "microsoft",
    }


async def delete_event(interviewer_id: str, event_id: str) -> bool:
    token = await get_valid_access_token(interviewer_id)
    if not token:
        return False
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.delete(f"{GRAPH}/me/events/{event_id}", headers={"Authorization": f"Bearer {token}"})
    return r.status_code in (204, 404)
