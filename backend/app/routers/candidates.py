"""Candidate management API routes."""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.dependencies import get_supabase
from app.services import intake
from app.security import CurrentUser, require_user
from app.services.tenancy import current_org, scope, stamp

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
    query = scope(supabase.table("candidates").select(
        "id, name, email, phone, stage, score, qualification_status, created_at, jobs(title)"
    )).order("created_at", desc=True).limit(limit)

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

    result = supabase.table("candidates").insert(stamp(data)).execute()
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


# ── Bulk intake ──────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _existing_keys() -> tuple[set[str], set[str]]:
    """Phones and emails already in this org, for de-duplication."""
    res = scope(get_supabase().table("candidates").select("phone, email")).limit(20000).execute()
    phones = {r["phone"] for r in res.data or [] if r.get("phone")}
    emails = {r["email"].lower() for r in res.data or [] if r.get("email")}
    return phones, emails


@router.post("/import")
async def import_candidates(
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
    dry_run: bool = Form(False),
):
    """Import a CSV (export Excel / Google Sheets as CSV). Duplicates by phone or email are skipped."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB")
    rows, errors, mapping = intake.parse_csv(data)
    if "name" not in mapping.values() or "phone" not in mapping.values():
        raise HTTPException(status_code=400, detail=(
            "The sheet needs a name column and a phone column. Found: " + ", ".join(mapping) if mapping
            else "No recognisable columns. Include at least Name and Phone."))

    phones, emails = _existing_keys()
    fresh, duplicates = [], []
    for row in rows:
        email = (row.get("email") or "").lower()
        if row["phone"] in phones or (email and email in emails):
            duplicates.append({"name": row["name"], "phone": row["phone"]})
            continue
        phones.add(row["phone"])
        if email:
            emails.add(email)
        fresh.append(stamp({**row, "job_id": job_id or None, "source": "csv"}))

    created = 0
    if not dry_run and fresh:
        for i in range(0, len(fresh), 500):
            res = get_supabase().table("candidates").insert(fresh[i:i + 500]).execute()
            created += len(res.data or [])
    return {
        "columns": mapping,
        "created": created if not dry_run else 0,
        "would_create": len(fresh),
        "duplicates": duplicates,
        "errors": errors,
        "preview": fresh[:5],
    }


async def _match_and_save(candidate_id: str, parsed: dict, job_id: str | None) -> dict | None:
    if not job_id:
        return None
    job = get_supabase().table("jobs").select(
        "title, role_type, work_model, required_skills, job_description").eq("id", job_id).single().execute().data
    match = await intake.match_to_job(parsed, job or {})
    if match:
        get_supabase().table("candidates").update({
            "match_score": match["score"],
            "match_reasons": {"strengths": match.get("strengths", []), "gaps": match.get("gaps", []),
                              "one_line": match.get("one_line")},
        }).eq("id", candidate_id).execute()
    return match


@router.post("/resumes")
async def upload_resumes(files: list[UploadFile] = File(...), job_id: str | None = Form(None)):
    """Drop in resumes (PDF, DOCX, TXT): each becomes a candidate with parsed fields and a match score."""
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Upload at most 50 resumes at once")
    phones, emails = _existing_keys()
    results = []
    for f in files:
        data = await f.read()
        name = f.filename or "resume"
        if len(data) > MAX_UPLOAD_BYTES:
            results.append({"file": name, "status": "error", "error": "larger than 10 MB"})
            continue
        try:
            text = intake.extract_text(name, data)
        except Exception as e:
            results.append({"file": name, "status": "error", "error": f"couldn't read the file: {e}"})
            continue
        if len(text) < 100:
            results.append({"file": name, "status": "error", "error": "no readable text (scanned image?)"})
            continue

        parsed = await intake.parse_resume(text)
        fields = intake.candidate_fields_from_resume(parsed)
        if not fields.get("name"):
            results.append({"file": name, "status": "error", "error": "couldn't find a name", "parsed": parsed})
            continue
        email = (fields.get("email") or "").lower()
        if fields.get("phone") in phones or (email and email in emails):
            results.append({"file": name, "status": "duplicate", "name": fields["name"]})
            continue

        path = f"{current_org() or 'shared'}/{uuid.uuid4()}-{name}"
        try:
            get_supabase().storage.from_("resumes").upload(
                path, data, {"content-type": f.content_type or "application/octet-stream"})
        except Exception:
            path = None   # storage not set up: keep the parsed text anyway

        row = stamp({
            **fields,
            "phone": fields.get("phone") or "",
            "job_id": job_id or None,
            "source": "resume",
            "resume_url": path,
            "resume_text": text,
            "resume_parsed": parsed,
        })
        created = get_supabase().table("candidates").insert(row).execute().data[0]
        if fields.get("phone"):
            phones.add(fields["phone"])
        if email:
            emails.add(email)
        match = await _match_and_save(created["id"], parsed, job_id)
        results.append({
            "file": name, "status": "created", "candidate_id": created["id"], "name": fields["name"],
            "needs_phone": not fields.get("phone"), "match_score": (match or {}).get("score"),
        })
    return {"results": results}


@router.post("/{candidate_id}/match")
async def rematch(candidate_id: str):
    """Recompute the resume-to-job match (e.g. after the job description changed)."""
    c = get_supabase().table("candidates").select("resume_parsed, job_id").eq("id", candidate_id).single().execute().data
    if not c or not c.get("resume_parsed"):
        raise HTTPException(status_code=400, detail="This candidate has no parsed resume")
    match = await _match_and_save(candidate_id, c["resume_parsed"], c.get("job_id"))
    if not match:
        raise HTTPException(status_code=502, detail="Couldn't score the match right now")
    return match


# ── Messages ─────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    body: str


@router.post("/{candidate_id}/messages")
async def send_message(candidate_id: str, req: SendMessageRequest):
    """A recruiter writes to the candidate on WhatsApp (or SMS)."""
    from app.services import messaging
    text = req.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message is empty")
    try:
        return messaging.send(candidate_id, text[:1500], purpose="manual", author="recruiter")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{candidate_id}/erase")
async def erase(candidate_id: str, user: CurrentUser = Depends(require_user)):
    """Right to erasure: delete the candidate and everything about them."""
    from app.services import compliance
    compliance.erase_candidate(candidate_id, actor=user.id)
    return {"ok": True}


@router.post("/{candidate_id}/rescore")
async def rescore(candidate_id: str):
    """Score again from the latest screening call, with the job's current rubric and must-haves."""
    from app.services import db as _db
    from app.services.scoring import score_candidate

    supabase = get_supabase()
    call = supabase.table("calls").select("extracted_data").eq("candidate_id", candidate_id).eq(
        "call_type", "screening").not_.is_("extracted_data", "null").order("created_at", desc=True).limit(1).execute().data
    if not call or not call[0].get("extracted_data"):
        raise HTTPException(status_code=400, detail="No screening call with answers to score yet")
    candidate = _db.get_candidate(candidate_id)
    card = await score_candidate(candidate, call[0]["extracted_data"])
    if card.get("score") is None:
        raise HTTPException(status_code=502, detail=card.get("reason") or "Scoring failed")
    update = {"score": card["score"], "score_breakdown": card.get("breakdown"),
              "qualification_status": "qualified" if card["qualified"] else "unqualified",
              "disqualification_reason": None if card["qualified"] else card.get("reason")}
    supabase.table("candidates").update(update).eq("id", candidate_id).execute()
    return card



@router.get("/{candidate_id}/documents/{doc_id}/url")
async def document_url(candidate_id: str, doc_id: str):
    """Short-lived link to view an uploaded onboarding document."""
    doc = get_supabase().table("candidate_documents").select("file_path, candidate_id").eq(
        "id", doc_id).single().execute().data
    if not doc or doc["candidate_id"] != candidate_id:
        raise HTTPException(status_code=404, detail="Document not found")
    signed = get_supabase().storage.from_("documents").create_signed_url(doc["file_path"], 600)
    return {"url": signed.get("signedURL") or signed.get("signedUrl")}
