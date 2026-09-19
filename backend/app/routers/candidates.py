"""Candidate management API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.dependencies import get_supabase

router = APIRouter()


class CreateCandidateRequest(BaseModel):
    name: str
    phone: str
    email: str | None = None
    job_id: str | None = None


class UpdateCandidateRequest(BaseModel):
    stage: str | None = None
    score: float | None = None
    qualification_status: str | None = None


@router.get("/")
async def list_candidates(
    stage: str | None = None,
    job_id: str | None = None,
    q: str | None = None,
    limit: int = 50,
):
    """List candidates with filters."""
    supabase = get_supabase()
    query = supabase.table("candidates").select(
        "id, name, email, phone, stage, score, qualification_status, created_at, jobs(title)"
    ).order("created_at", desc=True).limit(limit)

    if stage:
        query = query.eq("stage", stage)
    if job_id:
        query = query.eq("job_id", job_id)
    if q:
        query = query.or_(f"name.ilike.%{q}%,email.ilike.%{q}%,phone.ilike.%{q}%")

    result = query.execute()
    return {"candidates": result.data, "total": len(result.data)}


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str):
    """Get candidate detail."""
    supabase = get_supabase()
    result = supabase.table("candidates").select(
        "*, jobs(title, department, role_type, work_model)"
    ).eq("id", candidate_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return result.data


@router.post("/")
async def create_candidate(req: CreateCandidateRequest):
    """Create a new candidate."""
    supabase = get_supabase()
    data = {"name": req.name, "phone": req.phone}
    if req.email:
        data["email"] = req.email
    if req.job_id:
        data["job_id"] = req.job_id

    result = supabase.table("candidates").insert(data).execute()
    return result.data[0] if result.data else {}


@router.patch("/{candidate_id}")
async def update_candidate(candidate_id: str, req: UpdateCandidateRequest):
    """Update candidate stage, score, or status."""
    supabase = get_supabase()
    data = req.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("candidates").update(data).eq("id", candidate_id).execute()
    return result.data[0] if result.data else {}


@router.get("/{candidate_id}/calls")
async def get_candidate_calls(candidate_id: str):
    """Get all calls for a candidate."""
    supabase = get_supabase()
    result = supabase.table("calls").select("*").eq(
        "candidate_id", candidate_id
    ).order("created_at", desc=True).execute()
    return {"calls": result.data}
