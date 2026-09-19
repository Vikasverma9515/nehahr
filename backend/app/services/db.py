"""Supabase database operations for calls and candidates."""

from datetime import datetime, timezone

from app.dependencies import get_supabase


def create_call_record(
    candidate_id: str,
    call_type: str,
    twilio_call_sid: str | None = None,
    to_number: str | None = None,
) -> dict:
    """Create a new call record in Supabase."""
    supabase = get_supabase()
    result = supabase.table("calls").insert({
        "candidate_id": candidate_id,
        "call_type": call_type,
        "twilio_call_sid": twilio_call_sid,
        "direction": "outbound",
        "to_number": to_number,
        "status": "queued",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return result.data[0] if result.data else {}


def update_call_status(call_id: str, status: str, **kwargs) -> dict:
    """Update call status and optional fields."""
    supabase = get_supabase()
    data = {"status": status, **kwargs}
    result = supabase.table("calls").update(data).eq("id", call_id).execute()
    return result.data[0] if result.data else {}


def update_call_by_sid(twilio_call_sid: str, **kwargs) -> dict:
    """Update call by Twilio SID."""
    supabase = get_supabase()
    result = supabase.table("calls").update(kwargs).eq("twilio_call_sid", twilio_call_sid).execute()
    return result.data[0] if result.data else {}


def complete_call(
    call_id: str,
    transcript: str,
    ai_summary: str | None = None,
    extracted_data: dict | None = None,
    duration_seconds: int | None = None,
) -> dict:
    """Mark call as completed and save transcript/data."""
    supabase = get_supabase()
    data = {
        "status": "completed",
        "transcript": transcript,
        "ai_summary": ai_summary,
        "extracted_data": extracted_data,
        "duration_seconds": duration_seconds,
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }
    result = supabase.table("calls").update(data).eq("id", call_id).execute()
    return result.data[0] if result.data else {}


def get_call(call_id: str) -> dict | None:
    """Get a call record by ID."""
    supabase = get_supabase()
    result = supabase.table("calls").select("*").eq("id", call_id).single().execute()
    return result.data


def get_call_by_sid(twilio_call_sid: str) -> dict | None:
    """Get a call record by Twilio SID."""
    supabase = get_supabase()
    result = supabase.table("calls").select("*").eq("twilio_call_sid", twilio_call_sid).maybe_single().execute()
    return result.data


def get_candidate(candidate_id: str) -> dict | None:
    """Get a candidate by ID."""
    supabase = get_supabase()
    result = supabase.table("candidates").select("*, jobs(title, role_type, required_skills, work_model)").eq("id", candidate_id).single().execute()
    return result.data


def update_candidate(candidate_id: str, **kwargs) -> dict:
    """Update candidate fields."""
    supabase = get_supabase()
    result = supabase.table("candidates").update(kwargs).eq("id", candidate_id).execute()
    return result.data[0] if result.data else {}


def list_candidates_for_screening() -> list[dict]:
    """Get candidates in 'new' stage that haven't been contacted."""
    supabase = get_supabase()
    result = supabase.table("candidates").select("id, name, phone, job_id").eq("stage", "new").is_("last_contact_at", "null").limit(20).execute()
    return result.data or []
