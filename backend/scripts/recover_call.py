"""Recover transcript + extracted data for a call that has a Twilio recording
but no transcript in the DB (happens when WebSocket closes before _end_call).

Usage:
    ./venv/bin/python scripts/recover_call.py <call_id>
    ./venv/bin/python scripts/recover_call.py --latest    # recover most recent empty call
"""

import sys
import asyncio
from pathlib import Path

# Make "app.*" importable when running from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

from app.config import settings
from app.services import db
from app.services.ai_conversation import call_claude, _try_parse_json
from app.services.scoring import score_candidate


CANDIDATE_FIELDS = {
    "current_location", "open_to_relocation", "work_model_preference",
    "employment_status", "notice_period_days", "current_ctc", "expected_ctc",
    "reason_for_leaving", "role_specific_answers",
}


async def transcribe_twilio_recording(recording_url: str) -> str:
    """Fetch Twilio recording with auth and transcribe via Deepgram batch API."""
    # Strip .mp3 suffix (we added it for browser playback but Twilio accepts both)
    base_url = recording_url[:-4] if recording_url.endswith(".mp3") else recording_url

    # Fetch audio from Twilio
    print(f"  Fetching audio from Twilio...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        audio_resp = await client.get(
            f"{base_url}.mp3",
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        )
        audio_resp.raise_for_status()
        audio_bytes = audio_resp.content

    print(f"  Got {len(audio_bytes)} bytes of audio")

    # Send to Deepgram
    print(f"  Transcribing via Deepgram...")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": "audio/mpeg",
            },
            params={
                "model": "nova-2",
                "language": "en",
                "smart_format": "true",
                "diarize": "true",
                "punctuate": "true",
                "paragraphs": "true",
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        data = resp.json()

    channels = data.get("results", {}).get("channels", [])
    if not channels:
        return ""

    alt = channels[0].get("alternatives", [{}])[0]

    # Try paragraphs with speaker labels first
    paragraphs = alt.get("paragraphs", {}).get("paragraphs", [])
    if paragraphs:
        lines = []
        for para in paragraphs:
            speaker = para.get("speaker", 0)
            # Speaker 0 is usually the first voice (Neha, since she speaks first)
            speaker_name = "Neha" if speaker == 0 else "Candidate"
            text = " ".join(s.get("text", "") for s in para.get("sentences", []))
            if text.strip():
                lines.append(f"{speaker_name}: {text}")
        return "\n".join(lines)

    # Fallback: plain transcript
    return alt.get("transcript", "")


async def extract_and_summarize(transcript: str) -> tuple[str | None, dict]:
    """Send transcript to Claude to get a summary + extracted structured data."""
    prompt = f"""Analyze this HR screening call transcript and extract structured data.

Transcript:
{transcript}

Return ONLY a raw JSON object (no markdown, no ```) with these keys:
{{
  "summary": "2-3 sentence summary focusing on location, CTC, notice period, fit",
  "extracted": {{
    "current_location": "city, state",
    "open_to_relocation": true,
    "work_model_preference": "hybrid/remote/office",
    "employment_status": "intern | fresher | employed | notice_period | between_jobs",
    "notice_period_days": 30,
    "current_ctc": {{"fixed": X, "variable": Y}},
    "expected_ctc": {{"min": X, "max": Y}},
    "role_specific_answers": "brief description of relevant experience"
  }}
}}

## CRITICAL — CTC units
All CTC values MUST be in LPA (lakhs per annum) as numbers, NOT rupees.
- "30,000 per month" → 3.6 LPA → {{"fixed": 3.6}}
- "20 lakhs per annum" → {{"min": 20, "max": 20}}
- "16 lakhs fixed + 2 lakhs variable" → {{"fixed": 16, "variable": 2}}
- "CTC range of 15 to 18 lakhs" → {{"min": 15, "max": 18}}
Convert monthly salaries to annual LPA (multiply monthly rupees by 12, divide by 100000).

## CRITICAL — Employment status
Use "intern" if the candidate mentions they are currently interning, a trainee, or an apprentice.
Use "fresher" if they are a new graduate with no full-time work experience.
Use "employed" ONLY for full-time employees at another company.
Use "notice_period" if they are serving notice at a full-time job.
Use "between_jobs" if currently unemployed.
This matters for scoring — interns and freshers are evaluated differently from employed candidates.

Only include fields that were actually discussed in the call.
The first character of your response must be {{ and the last must be }}."""

    raw = await call_claude(
        system="You are an HR data extraction assistant. Return only raw JSON, no markdown.",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
    )

    parsed = _try_parse_json(raw)
    if not parsed:
        print(f"  Claude returned invalid JSON: {raw[:200]}")
        return None, {}

    return parsed.get("summary"), parsed.get("extracted", {})


async def recover_call(call_id: str):
    """Recover a call's transcript, summary, extracted data, and score."""
    call = db.get_call(call_id)
    if not call:
        print(f"Call {call_id} not found")
        return

    recording_url = call.get("recording_url")
    if not recording_url:
        print(f"No recording URL for call {call_id}")
        return

    print(f"Recovering call {call_id}")
    print(f"  Type: {call.get('call_type')}")
    print(f"  Recording: {recording_url}")

    # Step 1: Transcribe
    transcript = await transcribe_twilio_recording(recording_url)
    if not transcript:
        print("  Transcription failed")
        return

    print(f"  Transcript: {len(transcript)} chars")
    print()
    print("  --- Transcript preview ---")
    for line in transcript.split("\n")[:6]:
        print(f"    {line[:120]}")
    print("  ---")
    print()

    # Step 2: Extract + summarize via Claude
    print(f"  Extracting structured data via Claude...")
    summary, extracted = await extract_and_summarize(transcript)
    if summary:
        print(f"  Summary: {summary[:120]}...")
    if extracted:
        print(f"  Extracted {len(extracted)} fields: {list(extracted.keys())}")

    # Step 3: Save to DB
    db.complete_call(
        call_id=call_id,
        transcript=transcript,
        ai_summary=summary,
        extracted_data=extracted,
    )
    print(f"  Saved to DB")

    # Step 4: Score + update candidate (screening calls only)
    candidate_id = call.get("candidate_id")
    if candidate_id and call.get("call_type") == "screening":
        candidate = db.get_candidate(candidate_id)
        if candidate:
            print(f"  Scoring candidate...")
            scorecard = await score_candidate(candidate, extracted)
            print(f"  Scorecard: {scorecard.get('score')}/100 — {scorecard.get('reason', '')[:100]}")

            update_fields = {}
            for key, value in (extracted or {}).items():
                if key in CANDIDATE_FIELDS and value is not None and value != "":
                    update_fields[key] = value

            if scorecard.get("score") is not None:
                update_fields["score"] = scorecard["score"]
                update_fields["score_breakdown"] = scorecard.get("breakdown")
                if scorecard.get("qualified"):
                    update_fields["qualification_status"] = "qualified"
                    update_fields["stage"] = "screened"
                    update_fields["disqualification_reason"] = None
                else:
                    update_fields["qualification_status"] = "unqualified"
                    update_fields["stage"] = "rejected"
                    update_fields["disqualification_reason"] = scorecard.get("reason", "")
            else:
                update_fields["stage"] = "screened"
                update_fields["disqualification_reason"] = None

            db.update_candidate(candidate_id, **update_fields)
            print(f"  Updated candidate with {len(update_fields)} fields")

    print()
    print("Done.")


def find_latest_empty_call() -> str | None:
    """Find the most recent call that has a recording but no transcript."""
    supabase = db.get_supabase()
    result = (
        supabase.table("calls")
        .select("id, recording_url, transcript, created_at")
        .is_("transcript", "null")
        .not_.is_("recording_url", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]
    return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python scripts/recover_call.py <call_id>")
        print("  python scripts/recover_call.py --latest")
        sys.exit(1)

    arg = sys.argv[1]
    if arg == "--latest":
        cid = find_latest_empty_call()
        if not cid:
            print("No empty calls found")
            sys.exit(0)
        print(f"Latest empty call: {cid}")
    else:
        cid = arg

    asyncio.run(recover_call(cid))
