"""Seed a pre-screened candidate into the DB.

Use this to skip the real screening call when you want to test the
Shortlist → Schedule Interview flow end-to-end.

The inserted candidate is `stage='screened', qualification_status='qualified'`
with a full scorecard and all demographic fields populated, so the candidate
detail page renders exactly as if Neha had just finished a screening call.

Usage:
    ./venv/bin/python scripts/seed_screened_candidate.py \\
        --name "Aarav Sharma" \\
        --phone "+919876543210" \\
        --email "aarav@example.com"

    # Pick a specific job (otherwise the first active job is used):
    ./venv/bin/python scripts/seed_screened_candidate.py \\
        --name "Aarav Sharma" --phone "+919876543210" \\
        --job-id 3f1a...

    # List active jobs:
    ./venv/bin/python scripts/seed_screened_candidate.py --list-jobs
"""

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

# Make "app.*" importable when running from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import db


SCORECARD = {
    "location_fit": 90,
    "work_model_fit": 85,
    "notice_period_fit": 80,
    "ctc_alignment": 75,
    "role_experience": 82,
    "salary_trajectory": 78,
}

OVERALL_SCORE = 81


def list_jobs() -> list[dict]:
    supabase = db.get_supabase()
    result = (
        supabase.table("jobs")
        .select("id, title, department, status, default_interviewer_id")
        .eq("status", "active")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def print_jobs(jobs: list[dict]) -> None:
    if not jobs:
        print("No active jobs found. Create one via /dashboard/jobs/new first.")
        return
    print(f"{'ID':<38}  {'Title':<35}  Dept            Default interviewer?")
    print("-" * 110)
    for j in jobs:
        has_interviewer = "yes" if j.get("default_interviewer_id") else "NO"
        print(
            f"{j['id']:<38}  {(j.get('title') or '-')[:35]:<35}  "
            f"{(j.get('department') or '-')[:15]:<15} {has_interviewer}"
        )


def seed(
    name: str,
    phone: str,
    email: str | None,
    job_id: str | None,
) -> str:
    supabase = db.get_supabase()

    # Resolve job
    if job_id is None:
        jobs = list_jobs()
        if not jobs:
            raise SystemExit("No active jobs available. Create one first.")
        job = jobs[0]
        job_id = job["id"]
        print(f"[seed] Using first active job: {job.get('title')} ({job_id})")
        if not job.get("default_interviewer_id"):
            print(
                "[seed] WARN: this job has no default interviewer — you won't be able "
                "to Schedule Interview until you set one on the job detail page."
            )

    now_iso = datetime.now(timezone.utc).isoformat()

    payload = {
        "job_id": job_id,
        "name": name,
        "phone": phone,
        "email": email,
        # Demographics
        "current_location": "Bengaluru",
        "open_to_relocation": True,
        "work_model_preference": "hybrid",
        "employment_status": "employed",
        "notice_period_days": 30,
        "current_ctc": {"fixed": 16, "variable": 2},
        "expected_ctc": {"min": 22, "max": 26},
        # Scoring
        "qualification_status": "qualified",
        "score": OVERALL_SCORE,
        "score_breakdown": SCORECARD,
        "disqualification_reason": None,
        # Stage — ready for HR shortlist
        "stage": "screened",
        "last_contact_at": now_iso,
        # Scheduling flags
        "needs_manual_scheduling": False,
        "scheduling_notes": None,
    }

    result = supabase.table("candidates").insert(payload).execute()
    if not result.data:
        raise SystemExit("Insert returned no data — check RLS / schema.")

    candidate = result.data[0]
    candidate_id = candidate["id"]

    # Write a synthetic screening-call record so the Call History card on the
    # candidate page isn't blank (purely cosmetic).
    supabase.table("calls").insert({
        "candidate_id": candidate_id,
        "call_type": "screening",
        "direction": "outbound",
        "to_number": phone,
        "status": "completed",
        "duration_seconds": 180,
        "started_at": now_iso,
        "completed_at": now_iso,
        "transcript": (
            f"Neha: Hi, is this {name}? This is Neha from the recruiting team, calling about the role.\n"
            f"Candidate: Yes, hi.\n"
            f"Neha: Great! Quick screening — are you currently in Bengaluru?\n"
            f"Candidate: Yes.\n"
            f"Neha: And current CTC?\n"
            f"Candidate: 16 fixed plus 2 variable.\n"
            f"Neha: Notice period?\n"
            f"Candidate: 30 days.\n"
            f"Neha: Perfect. We'll be in touch soon.\n"
        ),
        "ai_summary": (
            f"{name} is currently based in Bengaluru, working full-time earning "
            "16L fixed + 2L variable. Expected range 22–26 LPA. 30-day notice. "
            "Open to hybrid. Strong fit."
        ),
        "extracted_data": {
            "current_location": "Bengaluru",
            "open_to_relocation": True,
            "work_model_preference": "hybrid",
            "employment_status": "employed",
            "notice_period_days": 30,
            "current_ctc": {"fixed": 16, "variable": 2},
            "expected_ctc": {"min": 22, "max": 26},
        },
    }).execute()

    return candidate_id


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", help="Candidate full name")
    parser.add_argument("--phone", help="Candidate phone in E.164, e.g. +919876543210")
    parser.add_argument("--email", default=None, help="Candidate email (optional)")
    parser.add_argument("--job-id", default=None, help="UUID of the job (defaults to first active job)")
    parser.add_argument("--list-jobs", action="store_true", help="List active jobs and exit")
    args = parser.parse_args()

    if args.list_jobs:
        print_jobs(list_jobs())
        return

    if not args.name or not args.phone:
        parser.error("--name and --phone are required (or pass --list-jobs)")

    phone = args.phone
    if not phone.startswith("+"):
        phone = f"+91{phone.lstrip('0')}"

    candidate_id = seed(
        name=args.name,
        phone=phone,
        email=args.email,
        job_id=args.job_id,
    )

    print("\n[seed] Candidate created:")
    print(f"  id:    {candidate_id}")
    print(f"  stage: screened (qualified, score={OVERALL_SCORE})")
    print(f"  open:  /dashboard/candidates/{candidate_id}")


if __name__ == "__main__":
    main()
