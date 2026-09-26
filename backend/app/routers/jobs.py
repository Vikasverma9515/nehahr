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


# ── Screening builder ────────────────────────────────────────────────────

GENERATE_PROMPT = """You design phone screening for recruiters. From this job, write:
- 3 to 5 role-fit questions a recruiter can ask by phone (open questions that need a concrete
  example; no yes/no), each with one line on what a good answer contains,
- 2 to 4 short knock-out rules (only real deal-breakers from the job text),
- 4 to 6 deeper first-round interview questions.
Reply with ONLY JSON:
{{"questions": [{{"text": str, "what_good_looks_like": str}}],
  "knockouts": [str],
  "interview_questions": [{{"text": str}}]}}

Job title: {title}
Role type: {role_type}  Work model: {work_model}  Location: {location}
Salary: {salary}
Required skills: {skills}
Description:
{description}
"""


@router.post("/{job_id}/screening/generate")
async def generate_screening(job_id: str):
    """Draft screening questions and knock-outs from the job description (not saved)."""
    from app.services.ai_conversation import call_claude
    from app.services.intake import _json_from

    supabase = get_supabase()
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    salary = (f"{job.get('salary_range_min')}-{job.get('salary_range_max')} LPA"
              if job.get("salary_range_max") else "not set")
    raw = await call_claude(
        system="You write concise, fair screening questions. Output JSON only.",
        messages=[{"role": "user", "content": GENERATE_PROMPT.format(
            title=job.get("title"), role_type=job.get("role_type") or "other",
            work_model=job.get("work_model") or "any", location=job.get("location") or "any",
            salary=salary, skills=", ".join(job.get("required_skills") or []) or "not listed",
            description=(job.get("job_description") or "")[:4000],
        )}],
        max_tokens=1200,
        use_sonnet=True,
    )
    draft = _json_from(raw)
    if not draft or not draft.get("questions"):
        raise HTTPException(status_code=502, detail="Couldn't draft questions right now; try again")
    return {
        "questions": draft.get("questions", [])[:6],
        "knockouts": draft.get("knockouts", [])[:5],
        "interview_questions": draft.get("interview_questions", [])[:8],
    }
