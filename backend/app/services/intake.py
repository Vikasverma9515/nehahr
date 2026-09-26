"""Bulk intake: CSV/Excel-exported sheets and resumes.

* ``parse_csv`` maps whatever headers the sheet has (Naukri exports, Google
  Forms, hand-made sheets) onto candidate fields.
* ``extract_text`` reads PDF, DOCX or plain-text resumes.
* ``parse_resume`` asks Claude for structured fields.
* ``match_to_job`` scores the resume against the job before any call, so Neha
  phones the best-matching candidates first.
"""

from __future__ import annotations

import csv
import io
import json
import re

from app.services.phone import to_e164

# Header aliases, compared after lowercasing and stripping non-letters.
FIELD_ALIASES: dict[str, list[str]] = {
    "name": ["name", "fullname", "candidatename", "candidate", "applicantname"],
    "phone": ["phone", "mobile", "mobileno", "mobilenumber", "phonenumber", "contact", "contactnumber", "whatsapp"],
    "email": ["email", "emailid", "emailaddress", "mail"],
    "current_location": ["location", "city", "currentlocation", "currentcity"],
    "experience_years": ["experience", "totalexperience", "exp", "yearsofexperience", "experienceyears"],
    "current_company": ["company", "currentcompany", "currentemployer", "employer", "organization"],
    "current_title": ["title", "designation", "currentdesignation", "role", "currentrole"],
    "notice_period_days": ["noticeperiod", "notice", "noticeperioddays"],
    "linkedin_url": ["linkedin", "linkedinurl", "linkedinprofile"],
    "skills": ["skills", "keyskills", "skillset"],
    "resume_url": ["resume", "resumeurl", "cv", "cvlink", "resumelink"],
}

_KEY = re.compile(r"[^a-z]")


def _norm(header: str) -> str:
    return _KEY.sub("", header.lower())


def map_headers(headers: list[str]) -> dict[str, str]:
    """Sheet header → candidate field, for the headers we recognise."""
    mapping: dict[str, str] = {}
    for h in headers:
        n = _norm(h)
        for field, aliases in FIELD_ALIASES.items():
            if n in aliases and field not in mapping.values():
                mapping[h] = field
                break
    return mapping


def _number(value: str) -> float | None:
    m = re.search(r"\d+(\.\d+)?", value or "")
    return float(m.group()) if m else None


def parse_csv(data: bytes, default_region: str | None = None) -> tuple[list[dict], list[dict], dict[str, str]]:
    """Returns (rows, errors, header_mapping). Each row is ready to insert."""
    text = data.decode("utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    mapping = map_headers(reader.fieldnames or [])
    rows: list[dict] = []
    errors: list[dict] = []
    for i, raw in enumerate(reader, start=2):   # line 1 is the header
        row: dict = {}
        for header, field in mapping.items():
            value = (raw.get(header) or "").strip()
            if value:
                row[field] = value
        if not row.get("name"):
            if any((v or "").strip() for v in raw.values()):
                errors.append({"line": i, "error": "missing name"})
            continue
        try:
            row["phone"] = to_e164(row.get("phone", ""), default_region)
        except ValueError:
            phone = row.get("phone")
            errors.append({"line": i, "name": row["name"],
                           "error": f"invalid phone {phone!r}" if phone else "missing phone"})
            continue
        if "experience_years" in row:
            row["experience_years"] = _number(row["experience_years"])
        if "notice_period_days" in row:
            days = _number(row["notice_period_days"])
            # "2 months" → 60 days; bare numbers under 7 are usually months.
            if days is not None and ("month" in row["notice_period_days"].lower() or days < 7):
                days *= 30
            row["notice_period_days"] = int(days) if days is not None else None
        if "skills" in row:
            row["skills"] = [s.strip() for s in re.split(r"[,;|/]", row["skills"]) if s.strip()]
        rows.append(row)
    return rows, errors, mapping


# ── Resumes ─────────────────────────────────────────────────────────────

MAX_RESUME_CHARS = 20_000


def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages[:10])
    elif name.endswith(".docx"):
        import docx
        doc = docx.Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        text = data.decode("utf-8", errors="replace")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_RESUME_CHARS]


RESUME_PROMPT = """Extract structured data from this resume. Reply with ONLY a JSON object:
{"name": str|null, "email": str|null, "phone": str|null, "current_location": str|null,
 "current_company": str|null, "current_title": str|null, "experience_years": number|null,
 "skills": [str], "education": [{"degree": str, "institution": str, "year": str|null}],
 "companies": [{"name": str, "title": str, "from": str|null, "to": str|null}],
 "linkedin_url": str|null, "summary": "two sentences a recruiter would write"}
Use null when a field isn't in the resume. Don't invent anything.

Resume:
"""

MATCH_PROMPT = """You are a recruiter screening a resume against a job before calling the candidate.
Score the fit from 0 to 100 using only evidence in the resume. Reply with ONLY a JSON object:
{{"score": int, "strengths": [short strings], "gaps": [short strings], "one_line": str}}

Job: {title} ({role_type}, {work_model})
Required skills: {skills}
Description: {description}

Candidate resume summary:
{resume}
"""


def _json_from(raw: str) -> dict | None:
    from app.services.ai_conversation import _try_parse_json
    parsed = _try_parse_json(raw or "")
    if parsed is None:
        m = re.search(r"\{.*\}", raw or "", re.S)
        if m:
            try:
                parsed = json.loads(m.group())
            except json.JSONDecodeError:
                parsed = None
    return parsed


async def parse_resume(text: str) -> dict:
    from app.services.ai_conversation import call_claude
    raw = await call_claude(
        system="You extract facts from resumes into JSON. Output JSON only.",
        messages=[{"role": "user", "content": RESUME_PROMPT + text}],
        max_tokens=1200,
        use_sonnet=True,
    )
    parsed = _json_from(raw) or {}
    # call_claude's error envelope isn't a resume.
    parsed.pop("response", None)
    parsed.pop("should_end", None)
    return parsed


async def match_to_job(parsed: dict, job: dict) -> dict | None:
    if not job:
        return None
    from app.services.ai_conversation import call_claude
    resume = json.dumps({k: parsed.get(k) for k in (
        "current_title", "current_company", "experience_years", "skills", "companies", "education", "summary"
    )}, ensure_ascii=False)
    prompt = MATCH_PROMPT.format(
        title=job.get("title") or "", role_type=job.get("role_type") or "", work_model=job.get("work_model") or "",
        skills=", ".join(job.get("required_skills") or []) or "not listed",
        description=(job.get("job_description") or "")[:3000],
        resume=resume,
    )
    raw = await call_claude(
        system="You score resumes against jobs. Output JSON only.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        use_sonnet=True,
    )
    result = _json_from(raw)
    if not result or not isinstance(result.get("score"), (int, float)):
        return None
    result["score"] = max(0, min(100, int(result["score"])))
    return result


def candidate_fields_from_resume(parsed: dict) -> dict:
    fields = {k: parsed.get(k) for k in (
        "name", "email", "current_location", "current_company", "current_title", "linkedin_url",
    ) if parsed.get(k)}
    if isinstance(parsed.get("experience_years"), (int, float)):
        fields["experience_years"] = parsed["experience_years"]
    if parsed.get("skills"):
        fields["skills"] = [str(s) for s in parsed["skills"]][:40]
    if parsed.get("phone"):
        try:
            fields["phone"] = to_e164(str(parsed["phone"]))
        except ValueError:
            pass
    return fields
