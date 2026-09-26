"""Calling hours, retention and erasure.

* ``next_call_time`` keeps automated calls inside the org's calling hours
  (default 09:00-20:00 in the candidate's timezone, no weekends).
* ``purge_expired`` erases transcripts, recordings and messages older than
  the org's ``retention_days``.
* ``erase_candidate`` removes a candidate and everything about them on
  request, leaving only an audit entry.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services import db

DEFAULT_HOURS = {"start": 9, "end": 20, "timezone": "Asia/Kolkata", "weekends": False}


def audit(org_id: str | None, action: str, *, actor: str = "system", target_type: str | None = None,
          target_id: str | None = None, details: dict | None = None) -> None:
    try:
        db.get_supabase().table("audit_log").insert({
            "org_id": org_id, "actor": actor, "action": action,
            "target_type": target_type, "target_id": target_id, "details": details,
        }).execute()
    except Exception as e:  # never break the action over logging
        print(f"[AUDIT] {action} not logged: {e}")


def org_settings(org_id: str | None) -> dict:
    if not org_id:
        return {}
    try:
        return db.get_supabase().table("organizations").select("settings").eq(
            "id", org_id).single().execute().data.get("settings") or {}
    except Exception:
        return {}


def calling_hours(org_id: str | None) -> dict:
    return {**DEFAULT_HOURS, **(org_settings(org_id).get("calling_hours") or {})}


def next_call_time(hours: dict, now: datetime | None = None) -> datetime | None:
    """None if calling now is fine; otherwise the next allowed moment (UTC)."""
    tz = ZoneInfo(hours.get("timezone") or "Asia/Kolkata")
    local = (now or datetime.now(timezone.utc)).astimezone(tz)
    start, end = int(hours.get("start", 9)), int(hours.get("end", 20))
    weekends = bool(hours.get("weekends", False))

    def allowed_day(d: datetime) -> bool:
        return weekends or d.weekday() < 5

    if allowed_day(local) and start <= local.hour < end:
        return None
    candidate = local.replace(hour=start, minute=5, second=0, microsecond=0)
    if local.hour >= end or not allowed_day(local) or local >= candidate:
        candidate += timedelta(days=1)
    while not allowed_day(candidate):
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def purge_expired() -> dict:
    """Erase call content and messages past each org's retention period."""
    supabase = db.get_supabase()
    orgs = supabase.table("organizations").select("id, settings").execute().data or []
    totals = {"calls": 0, "messages": 0}
    for org in orgs:
        days = (org.get("settings") or {}).get("retention_days")
        if not days:
            continue
        cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).isoformat()
        calls = supabase.table("calls").update({
            "transcript": None, "transcript_segments": None, "recording_url": None, "extracted_data": None,
        }).eq("org_id", org["id"]).lt("created_at", cutoff).not_.is_("transcript", "null").execute().data or []
        msgs = supabase.table("messages").delete().eq("org_id", org["id"]).lt("created_at", cutoff).execute().data or []
        if calls or msgs:
            totals["calls"] += len(calls)
            totals["messages"] += len(msgs)
            audit(org["id"], "retention.purged", details={"calls": len(calls), "messages": len(msgs), "days": days})
    return totals


def erase_candidate(candidate_id: str, actor: str) -> None:
    """Delete a candidate and all their data (calls, interviews, messages cascade)."""
    supabase = db.get_supabase()
    c = supabase.table("candidates").select("id, org_id, resume_url").eq("id", candidate_id).single().execute().data
    if not c:
        return
    if c.get("resume_url"):
        try:
            supabase.storage.from_("resumes").remove([c["resume_url"]])
        except Exception:
            pass
    supabase.table("candidates").delete().eq("id", candidate_id).execute()
    audit(c.get("org_id"), "candidate.erased", actor=actor, target_type="candidate", target_id=candidate_id)
