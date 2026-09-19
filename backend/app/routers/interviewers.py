"""Interviewer management API."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import db

router = APIRouter()


class CreateInterviewerRequest(BaseModel):
    name: str
    email: str
    timezone: str = "Asia/Kolkata"
    working_hours_start: int = 9
    working_hours_end: int = 18


class UpdateInterviewerRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    timezone: str | None = None
    working_hours_start: int | None = None
    working_hours_end: int | None = None
    is_active: bool | None = None


@router.get("/")
async def list_interviewers():
    """List all interviewers."""
    supabase = db.get_supabase()
    result = supabase.table("interviewers").select("*").order("created_at", desc=False).execute()
    # Don't leak tokens to the frontend
    for row in result.data or []:
        row.pop("google_refresh_token", None)
        row.pop("google_access_token", None)
    return {"interviewers": result.data, "total": len(result.data or [])}


@router.post("/")
async def create_interviewer(req: CreateInterviewerRequest):
    """Add a new interviewer."""
    supabase = db.get_supabase()
    try:
        result = supabase.table("interviewers").insert(req.model_dump()).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    row = result.data[0] if result.data else {}
    row.pop("google_refresh_token", None)
    row.pop("google_access_token", None)
    return row


@router.get("/{interviewer_id}")
async def get_interviewer(interviewer_id: str):
    """Get a single interviewer (without tokens)."""
    supabase = db.get_supabase()
    result = supabase.table("interviewers").select("*").eq("id", interviewer_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    row = result.data
    row.pop("google_refresh_token", None)
    row.pop("google_access_token", None)
    return row


@router.patch("/{interviewer_id}")
async def update_interviewer(interviewer_id: str, req: UpdateInterviewerRequest):
    """Update interviewer details."""
    supabase = db.get_supabase()
    data = req.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("interviewers").update(data).eq("id", interviewer_id).execute()
    row = result.data[0] if result.data else {}
    row.pop("google_refresh_token", None)
    row.pop("google_access_token", None)
    return row


@router.delete("/{interviewer_id}")
async def delete_interviewer(interviewer_id: str):
    """Delete an interviewer."""
    supabase = db.get_supabase()
    supabase.table("interviewers").delete().eq("id", interviewer_id).execute()
    return {"deleted": True}
