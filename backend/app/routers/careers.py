"""Public careers page and apply form.

    GET  /api/careers/{org_slug}                 open, published jobs
    GET  /api/careers/{org_slug}/{job_id}        one job
    POST /api/careers/{org_slug}/{job_id}/apply  multipart: name, email, phone, resume, consent

Applications become candidates (source=careers_page) with the resume parsed
and matched to the job. If the job has ``auto_screen_min_match`` and the
match clears it, Neha phones the applicant automatically.
"""

from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.services import db, intake
from app.services.phone import to_e164

router = APIRouter()

_JOB_FIELDS = "id, title, department, location, work_model, job_description, required_skills, salary_range_min, salary_range_max, created_at"

# Small in-process limiter: 5 applications per IP per 10 minutes.
_recent: dict[str, deque] = defaultdict(deque)


def _rate_limited(ip: str) -> bool:
    now = time.time()
    q = _recent[ip]
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= 5:
        return True
    q.append(now)
    return False


def _org(slug: str) -> dict:
    res = db.get_supabase().table("organizations").select("id, name, settings").eq("slug", slug).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Careers page not found")
    return res.data[0]


@router.get("/{org_slug}")
async def list_jobs(org_slug: str):
    org = _org(org_slug)
    jobs = db.get_supabase().table("jobs").select(_JOB_FIELDS).eq("org_id", org["id"]).eq(
        "published", True).eq("status", "open").order("created_at", desc=True).execute().data or []
    return {"company": org["name"], "jobs": jobs}


def _job(org: dict, job_id: str) -> dict:
    res = db.get_supabase().table("jobs").select(_JOB_FIELDS + ", auto_screen_min_match").eq("id", job_id).eq(
        "org_id", org["id"]).eq("published", True).eq("status", "open").limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This job is no longer open")
    return res.data[0]


@router.get("/{org_slug}/{job_id}")
async def get_job(org_slug: str, job_id: str):
    org = _org(org_slug)
    job = _job(org, job_id)
    job.pop("auto_screen_min_match", None)
    return {"company": org["name"], "job": job}


@router.post("/{org_slug}/{job_id}/apply")
async def apply(
    org_slug: str,
    job_id: str,
    request: Request,
    name: str = Form(...),
    phone: str = Form(...),
    email: str = Form(""),
    consent: bool = Form(False),
    website: str = Form(""),          # honeypot: humans leave it empty
    resume: UploadFile | None = File(None),
):
    if website:
        return {"ok": True}           # quietly drop bots
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    if _rate_limited(ip):
        raise HTTPException(status_code=429, detail="Too many applications from this network; try again later")
    if not consent:
        raise HTTPException(status_code=400, detail="Please agree to be contacted about this application")
    org = _org(org_slug)
    job = _job(org, job_id)
    try:
        phone_e164 = to_e164(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number")

    supabase = db.get_supabase()
    dup = supabase.table("candidates").select("id").eq("org_id", org["id"]).eq("job_id", job_id).eq(
        "phone", phone_e164).limit(1).execute().data
    if dup:
        return {"ok": True, "duplicate": True}

    row: dict = {
        "org_id": org["id"], "job_id": job_id, "name": " ".join(name.split())[:120],
        "phone": phone_e164, "email": (email or "").strip().lower() or None, "source": "careers_page",
    }
    parsed: dict = {}
    if resume is not None and resume.filename:
        data = await resume.read()
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Resume must be under 10 MB")
        try:
            text = intake.extract_text(resume.filename, data)
        except Exception:
            text = ""
        if len(text) >= 100:
            parsed = await intake.parse_resume(text)
            fields = intake.candidate_fields_from_resume(parsed)
            for k in ("current_location", "current_company", "current_title", "linkedin_url", "experience_years", "skills"):
                if fields.get(k):
                    row[k] = fields[k]
            row["resume_text"] = text
            row["resume_parsed"] = parsed
        path = f"{org['id']}/{uuid.uuid4()}-{resume.filename}"
        try:
            supabase.storage.from_("resumes").upload(path, data, {"content-type": resume.content_type or "application/octet-stream"})
            row["resume_url"] = path
        except Exception:
            pass

    created = supabase.table("candidates").insert(row).execute().data[0]

    match = await intake.match_to_job(parsed, job) if parsed else None
    if match:
        supabase.table("candidates").update({
            "match_score": match["score"],
            "match_reasons": {"strengths": match.get("strengths", []), "gaps": match.get("gaps", []),
                              "one_line": match.get("one_line")},
        }).eq("id", created["id"]).execute()

    threshold = job.get("auto_screen_min_match")
    if threshold is not None and match and match["score"] >= threshold:
        from app.workers.queue import enqueue
        enqueue("call.initiate", {"candidate_id": created["id"], "call_type": "screening"},
                delay_seconds=120, dedupe_key=f"auto-screen:{created['id']}", org_id=org["id"])
        supabase.table("candidates").update({"stage": "screening"}).eq("id", created["id"]).execute()

    return {"ok": True}
