"""Jobs API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.dependencies import get_supabase
from app.services.tenancy import scope, stamp

router = APIRouter()


class CreateJobRequest(BaseModel):
    title: str
    department: str | None = None
    location: str | None = None
    work_model: str | None = None
    role_type: str | None = None
    job_description: str | None = None
    required_skills: list[str] | None = None
    salary_range_min: float | None = None
    salary_range_max: float | None = None


@router.get("/")
async def list_jobs(status: str | None = None):
    """List all jobs."""
    supabase = get_supabase()
    query = scope(supabase.table("jobs").select("*")).order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return {"jobs": result.data, "total": len(result.data)}


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get job detail."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return result.data


@router.post("/")
async def create_job(req: CreateJobRequest):
    """Create a new job."""
    supabase = get_supabase()
    result = supabase.table("jobs").insert(
        stamp(req.model_dump(exclude_none=True))
    ).execute()
    return result.data[0] if result.data else {}


@router.get("/{job_id}/pipeline")
async def get_pipeline(job_id: str):
    """Get candidate pipeline for a job, grouped by stage."""
    supabase = get_supabase()
    result = supabase.table("candidates").select(
        "id, name, stage, score"
    ).eq("job_id", job_id).order("created_at", desc=True).execute()

    pipeline: dict[str, list] = {}
    for c in result.data or []:
        stage = c["stage"]
        if stage not in pipeline:
            pipeline[stage] = []
        pipeline[stage].append(c)

    return {"job_id": job_id, "pipeline": pipeline, "total": len(result.data or [])}
