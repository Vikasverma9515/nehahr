"""Candidate scoring service — uses Claude to grade screening call data.

After a screening call, we send Claude:
- The candidate's extracted data (location, CTC, notice, etc.)
- The job's requirements (salary range, work model, role type, skills)
- A scoring rubric with weights

Claude returns a JSON scorecard with per-category scores and overall qualification.
"""

import json

from app.services.ai_conversation import call_claude


SCORING_SYSTEM_PROMPT = """You are an HR scoring assistant. You evaluate candidates based on a screening call and return a structured scorecard.

## Scoring rubric (weights)
- location_fit         (10%) — Is candidate's location compatible? Relocation openness counts.
- work_model_fit       (10%) — Does candidate's preference match job's work model?
- notice_period_fit    (15%) — Shorter notice = better. <30 days = excellent, 30-60 = good, 60-90 = acceptable, >90 = concern.
- ctc_alignment        (20%) — Is expected CTC within or near the job's salary range? This is the PRIMARY salary check.
- role_experience      (30%) — Does candidate's experience match the role type (technical / client_facing / team_handling)? Most important factor.
- salary_trajectory    (15%) — Is the expected hike from current CTC reasonable?

## CRITICAL: How to score salary_trajectory
Salary trajectory = "is the candidate's expected hike from their CURRENT FULL-TIME CTC reasonable?"

This category ONLY applies to candidates moving between FULL-TIME jobs.

Score salary_trajectory as 85 (neutral-positive, NOT penalized) in ALL these cases:
- employment_status is "intern" (stipend is not a career CTC, ignore hike math)
- employment_status is "fresher" (no prior full-time CTC to compare)
- employment_status is "between_jobs" (unemployed, no current CTC baseline)
- Candidate's current CTC is below 5 LPA (early-career, likely an intern/fresher mislabeled)
- Candidate mentions being a new graduate, trainee, student, or internship
- The candidate's expected CTC looks like a fresh market-rate ask for the role level, not a hike

An intern getting 30k/month stipend asking 20 LPA for a full-time role is NORMAL in India.
A fresher asking 15-25 LPA for a senior role is NOT a "hike from 0" — it's a new market-rate negotiation.
Do NOT compute hike percentages against stipends.

Only penalize salary_trajectory (score <60) when:
- employment_status is "employed" or "notice_period" at a real full-time CTC >5 LPA
- AND expected CTC is >60% above their current full-time CTC
- In that case, 60-100% hike = 50, >100% hike = 20, >150% hike = 0

## CRITICAL: ctc_alignment is the PRIMARY salary check
Compare candidate's expected CTC directly against the JOB'S salary range.

If the job's salary_range_min and salary_range_max are BOTH provided:
- Expected within job's range: 90-100
- Expected slightly above (up to 20%): 70-85
- Expected significantly above range: 30-50
- Expected way above range (>50% above): 0-20

If the job's salary range is MISSING or null (None/null/0):
- Do NOT penalize ctc_alignment for this reason alone.
- Score 75 as default — trust the market rate.
- Only reduce if the expected CTC is extreme for the role type (e.g. fresher asking 50 LPA for a support role).
- For reference, Indian market rates:
  - Fresher technical role: 6-15 LPA (strong profile could be 20+)
  - Mid-level (2-5 yrs) technical: 15-35 LPA
  - Senior (5-10 yrs) technical: 30-60 LPA
  - Engineering manager: 40-80 LPA
  - Account manager: 10-25 LPA

## Scoring scale
Each category: 0-100. Overall score = weighted sum (rounded to integer).
Qualified threshold: overall score >= 60 AND role_experience >= 50.

## Output format
Return ONLY a JSON object with these exact keys (no markdown, no extra text):
{
  "score": <int 0-100>,
  "qualified": <boolean>,
  "breakdown": {
    "location_fit": <int 0-100>,
    "work_model_fit": <int 0-100>,
    "notice_period_fit": <int 0-100>,
    "ctc_alignment": <int 0-100>,
    "role_experience": <int 0-100>,
    "salary_trajectory": <int 0-100>
  },
  "reason": "<one-sentence explanation of the qualification decision>"
}
"""


def _format_ctc(ctc) -> str:
    """Format a CTC dict/value into a readable string for Claude."""
    if not ctc:
        return "not provided"
    if isinstance(ctc, dict):
        parts = []
        if "fixed" in ctc:
            parts.append(f"Fixed: {ctc['fixed']}L")
        if "variable" in ctc:
            parts.append(f"Variable: {ctc['variable']}L")
        if "min" in ctc and "max" in ctc:
            parts.append(f"Range: {ctc['min']}-{ctc['max']}L")
        elif "min" in ctc:
            parts.append(f"Min: {ctc['min']}L")
        return ", ".join(parts) if parts else json.dumps(ctc)
    return str(ctc)


def _lpa(ctc) -> float | None:
    if isinstance(ctc, dict):
        for key in ("max", "min", "fixed"):
            if isinstance(ctc.get(key), (int, float)):
                return float(ctc[key]) + (float(ctc.get("variable") or 0) if key == "fixed" else 0)
    if isinstance(ctc, (int, float)):
        return float(ctc)
    return None


def check_must_haves(candidate: dict, extracted: dict, must: dict) -> list[str]:
    """Hard requirements HR set on the job. Returns the ones the candidate fails.

    Only fails on facts we actually have: a missing answer is not a failure.
    """
    if not must:
        return []
    failures: list[str] = []
    notice = extracted.get("notice_period_days")
    if must.get("max_notice_days") is not None and isinstance(notice, (int, float)) and notice > must["max_notice_days"]:
        failures.append(f"notice period {int(notice)} days > {must['max_notice_days']}")

    years = candidate.get("experience_years")
    if must.get("min_experience_years") is not None and isinstance(years, (int, float)) and years < must["min_experience_years"]:
        failures.append(f"{years:g} years of experience < {must['min_experience_years']}")

    expected = _lpa(extracted.get("expected_ctc"))
    if must.get("max_expected_ctc_lpa") is not None and expected is not None and expected > must["max_expected_ctc_lpa"]:
        failures.append(f"expects {expected:g} LPA > {must['max_expected_ctc_lpa']} LPA budget")

    allowed = [c.lower() for c in must.get("locations") or []]
    location = (extracted.get("current_location") or candidate.get("current_location") or "").lower()
    if allowed and location and not any(c in location for c in allowed):
        relocates = extracted.get("open_to_relocation")
        if not (must.get("allow_relocation", True) and relocates is True):
            failures.append(f"based in {location.title()}, not in {', '.join(must['locations'])}"
                            + ("" if relocates else " and not relocating"))

    models = must.get("work_models") or []
    pref = extracted.get("work_model_preference")
    if models and pref and pref not in models:
        failures.append(f"wants {pref} work, role is {'/'.join(models)}")
    return failures


async def score_candidate(candidate: dict, extracted: dict) -> dict:
    """Score a candidate based on extracted screening call data and job requirements.

    Returns a dict with score, qualified, breakdown, reason.
    Falls back to a neutral score if Claude fails or returns invalid JSON.
    """
    if not extracted:
        return {
            "score": None,
            "qualified": False,
            "breakdown": None,
            "reason": "No data extracted from call",
        }

    # Build job context
    job = candidate.get("jobs") or {}
    if not isinstance(job, dict):
        job = {}

    job_title = job.get("title", "unknown role")
    job_work_model = job.get("work_model", "any")
    job_role_type = job.get("role_type", "general")
    job_location = job.get("location", "any")
    salary_min = job.get("salary_range_min")
    salary_max = job.get("salary_range_max")
    required_skills = job.get("required_skills", []) or []

    # Format candidate data
    candidate_info = f"""
## Candidate data (from screening call)
- Current location: {extracted.get('current_location', 'not provided')}
- Open to relocation: {extracted.get('open_to_relocation', 'not asked')}
- Work model preference: {extracted.get('work_model_preference', 'not asked')}
- Employment status: {extracted.get('employment_status', 'not asked')}
- Notice period: {extracted.get('notice_period_days', 'not asked')} days
- Current CTC: {_format_ctc(extracted.get('current_ctc'))}
- Expected CTC: {_format_ctc(extracted.get('expected_ctc'))}
- Role-specific answers: {json.dumps(extracted.get('role_specific_answers')) if extracted.get('role_specific_answers') else 'none collected'}
"""

    job_info = f"""
## Job details
- Title: {job_title}
- Role type: {job_role_type}
- Location: {job_location}
- Work model: {job_work_model}
- Salary range: {salary_min}-{salary_max} LPA
- Required skills: {', '.join(required_skills) if required_skills else 'not specified'}
"""

    config = job.get("screening_config") or {}
    if config.get("questions") or config.get("knockouts"):
        job_info += "\n## What this team is screening for\n"
        for q in config.get("questions") or []:
            text = q.get("text") if isinstance(q, dict) else str(q)
            good = q.get("what_good_looks_like") if isinstance(q, dict) else None
            job_info += f"- Question: {text}" + (f" (a good answer: {good})" if good else "") + "\n"
        for k in config.get("knockouts") or []:
            job_info += f"- Knock-out rule: {k}\n"
        job_info += "Weigh these answers inside role_experience. A clearly failed knock-out rule means not qualified.\n"

    user_prompt = f"{job_info}\n{candidate_info}\n\nScore this candidate using the rubric. Return ONLY the JSON object."

    try:
        raw = await call_claude(
            system=SCORING_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
            max_tokens=500,
            use_sonnet=True,  # Scoring needs accuracy, not speed
        )
    except Exception as e:
        print(f"[SCORING] Claude call failed: {e}")
        return {
            "score": None,
            "qualified": False,
            "breakdown": None,
            "reason": f"Scoring failed: {e}",
        }

    # Parse the JSON response. Claude sometimes wraps in markdown, so strip it.
    raw = raw.strip()
    if raw.startswith("```"):
        # Remove markdown fences
        raw = raw.split("```")[1] if len(raw.split("```")) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[SCORING] Invalid JSON from Claude: {raw[:200]}")
        return {
            "score": None,
            "qualified": False,
            "breakdown": None,
            "reason": "Scoring returned invalid format",
        }

    # Validate and coerce
    score = parsed.get("score")
    if isinstance(score, (int, float)):
        score = int(round(score))
    else:
        score = None

    result = {
        "score": score,
        "qualified": bool(parsed.get("qualified", False)),
        "breakdown": parsed.get("breakdown"),
        "reason": parsed.get("reason", ""),
    }
    # HR's hard requirements always win over the model's judgement.
    failures = check_must_haves(candidate, extracted, config.get("must_haves") or {})
    if failures:
        result["qualified"] = False
        result["knockouts_failed"] = failures
        result["reason"] = "Knock-out: " + "; ".join(failures)
    return result
