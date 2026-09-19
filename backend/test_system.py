"""
Neha HR — System Test Suite
Run: cd backend && ./venv/bin/python test_system.py

Tests each component independently before making a live call.
"""

import os
import sys
import json
import time

# Load env
from dotenv import load_dotenv
load_dotenv("../.env")

PASS = "\033[92m PASS \033[0m"
FAIL = "\033[91m FAIL \033[0m"
SKIP = "\033[93m SKIP \033[0m"

results = []


def test(name, func):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    try:
        func()
        results.append((name, "PASS"))
        print(f"\n  {PASS} {name}")
    except Exception as e:
        results.append((name, f"FAIL: {e}"))
        print(f"\n  {FAIL} {name}: {e}")


# ============================================================
# 1. Environment Variables
# ============================================================
def test_env_vars():
    required = [
        "SUPABASE_URL", "SUPABASE_SERVICE_KEY",
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER",
        "DEEPGRAM_API_KEY",
        "AWS_BEARER_TOKEN_BEDROCK",
        "BACKEND_URL",
    ]
    missing = []
    for var in required:
        val = os.getenv(var, "")
        status = "OK" if val and val != "xxx" else "MISSING"
        print(f"  {var}: {status}")
        if status == "MISSING":
            missing.append(var)

    if missing:
        raise Exception(f"Missing env vars: {', '.join(missing)}")


# ============================================================
# 2. Supabase Connection
# ============================================================
def test_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    client = create_client(url, key)

    # Test read
    result = client.table("candidates").select("id, name").limit(3).execute()
    print(f"  Candidates found: {len(result.data)}")
    for c in result.data:
        print(f"    - {c['name']} ({c['id'][:8]}...)")

    # Test jobs
    result = client.table("jobs").select("id, title").limit(3).execute()
    print(f"  Jobs found: {len(result.data)}")
    for j in result.data:
        print(f"    - {j['title']}")

    if not result.data and len(result.data) == 0:
        print("  WARNING: No data in DB. Run seed.sql first.")


# ============================================================
# 3. Twilio Connection
# ============================================================
def test_twilio():
    from twilio.rest import Client
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    phone = os.getenv("TWILIO_PHONE_NUMBER")

    client = Client(sid, token)

    # Check account
    account = client.api.accounts(sid).fetch()
    print(f"  Account: {account.friendly_name}")
    print(f"  Status: {account.status}")
    print(f"  Phone: {phone}")

    # Check if phone number is valid
    numbers = client.incoming_phone_numbers.list(phone_number=phone)
    if numbers:
        print(f"  Number verified: YES")
    else:
        print(f"  WARNING: Phone number {phone} not found in account")


# ============================================================
# 4. Deepgram STT (Speech-to-Text)
# ============================================================
def test_deepgram_stt():
    import httpx
    api_key = os.getenv("DEEPGRAM_API_KEY")

    # Test with a simple pre-recorded audio URL
    response = httpx.post(
        "https://api.deepgram.com/v1/listen",
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "url": "https://dpgr.am/spacewalk.wav",
            "model": "nova-2",
            "language": "en",
            "smart_format": True,
        },
        timeout=30.0,
    )
    print(f"  Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
        print(f"  Transcript: {transcript[:100]}...")
    else:
        raise Exception(f"Deepgram STT failed: {response.status_code} - {response.text[:200]}")


# ============================================================
# 5. Deepgram TTS (Text-to-Speech)
# ============================================================
def test_deepgram_tts():
    import httpx
    api_key = os.getenv("DEEPGRAM_API_KEY")

    response = httpx.post(
        "https://api.deepgram.com/v1/speak",
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        },
        json={"text": "Hello, this is a test of the text to speech system."},
        params={
            "model": "aura-asteria-en",
            "encoding": "mulaw",
            "sample_rate": "8000",
            "container": "none",
        },
        timeout=15.0,
    )
    print(f"  Status: {response.status_code}")

    if response.status_code == 200:
        audio_size = len(response.content)
        print(f"  Audio bytes: {audio_size}")
        duration_approx = audio_size / 8000
        print(f"  Duration (approx): {duration_approx:.1f}s")
        if audio_size < 100:
            raise Exception("Audio too small — TTS may have failed")
    else:
        raise Exception(f"Deepgram TTS failed: {response.status_code} - {response.text[:200]}")


# ============================================================
# 6. AWS Bedrock (Claude)
# ============================================================
def test_bedrock():
    import httpx
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")

    url = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/invoke"
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 50,
        "messages": [{"role": "user", "content": "Say hello in exactly 3 words"}],
    }

    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=15.0,
    )
    print(f"  Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        text = data["content"][0]["text"]
        print(f"  Claude says: {text}")
        print(f"  Model: {data.get('model', 'unknown')}")
    else:
        raise Exception(f"Bedrock failed: {response.status_code} - {response.text[:300]}")


# ============================================================
# 7. Bedrock with Screening Prompt (JSON response)
# ============================================================
def test_bedrock_screening_prompt():
    import httpx
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")

    system_prompt = """You are Neha, an AI HR agent. You are on a screening call.
Respond with ONLY a JSON object:
{"response": "what you say", "phase": "greeting", "extracted": {}, "should_end": false}"""

    url = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/invoke"
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 200,
        "system": system_prompt,
        "messages": [
            {"role": "assistant", "content": "Hi, this is Neha from the recruiting team. Is this a good time?"},
            {"role": "user", "content": "Yes, go ahead"},
        ],
    }

    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=15.0,
    )
    print(f"  Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        raw = data["content"][0]["text"]
        print(f"  Raw response: {raw[:200]}")

        # Try parsing as JSON
        try:
            parsed = json.loads(raw)
            print(f"  JSON parsed: YES")
            print(f"  Response: {parsed.get('response', '')[:100]}")
            print(f"  Phase: {parsed.get('phase', '')}")
            print(f"  Should end: {parsed.get('should_end', '')}")
        except json.JSONDecodeError:
            print(f"  WARNING: Claude didn't return valid JSON")
    else:
        raise Exception(f"Bedrock failed: {response.status_code} - {response.text[:200]}")


# ============================================================
# 8. Backend Health Check
# ============================================================
def test_backend_health():
    import httpx
    try:
        response = httpx.get("http://localhost:8000/health", timeout=5.0)
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")
        else:
            raise Exception(f"Backend returned {response.status_code}")
    except httpx.ConnectError:
        raise Exception("Backend not running on port 8000. Start it first: ./venv/bin/uvicorn app.main:app --reload --port 8000")


# ============================================================
# 9. ngrok Tunnel
# ============================================================
def test_ngrok():
    import httpx
    backend_url = os.getenv("BACKEND_URL", "")

    if "localhost" in backend_url or not backend_url:
        raise Exception(f"BACKEND_URL is not set to ngrok: {backend_url}")

    print(f"  URL: {backend_url}")

    try:
        response = httpx.get(
            f"{backend_url}/health",
            timeout=10.0,
            headers={"ngrok-skip-browser-warning": "true"},
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")
        else:
            raise Exception(f"ngrok returned {response.status_code}. Is backend running?")
    except httpx.ConnectError:
        raise Exception("Cannot reach ngrok URL. Is ngrok running?")


# ============================================================
# 10. Full Pipeline (without actual call)
# ============================================================
def test_full_pipeline():
    """Test the full flow: DB → AI → TTS, without making an actual phone call."""
    import httpx
    from supabase import create_client

    # 1. Get a candidate from DB
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
    candidates = client.table("candidates").select("id, name, phone, jobs(title, role_type)").limit(1).execute()

    if not candidates.data:
        raise Exception("No candidates in DB. Run seed.sql first.")

    candidate = candidates.data[0]
    print(f"  Candidate: {candidate['name']}")
    print(f"  Phone: {candidate['phone']}")
    job_title = candidate.get("jobs", {}).get("title", "Unknown") if candidate.get("jobs") else "Unknown"
    print(f"  Job: {job_title}")

    # 2. Generate greeting (local, no API call)
    greeting = f"Hi, am I speaking with {candidate['name']}? This is Neha calling from the recruiting team about the {job_title} position. Is this a good time?"
    print(f"  Greeting: {greeting[:80]}...")

    # 3. Convert to audio via Deepgram TTS
    api_key = os.getenv("DEEPGRAM_API_KEY")
    tts_response = httpx.post(
        "https://api.deepgram.com/v1/speak",
        headers={"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
        json={"text": greeting},
        params={"model": "aura-asteria-en", "encoding": "mulaw", "sample_rate": "8000", "container": "none"},
        timeout=15.0,
    )
    print(f"  TTS: {len(tts_response.content)} bytes ({len(tts_response.content)/8000:.1f}s audio)")

    # 4. Simulate candidate response → Claude
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    system = f"You are Neha, an AI HR agent for the hiring company. Candidate: {candidate['name']}, Job: {job_title}. Respond with JSON: {{\"response\": \"...\", \"phase\": \"...\", \"extracted\": {{}}, \"should_end\": false}}"

    bedrock_response = httpx.post(
        "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/invoke",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 200,
            "system": system,
            "messages": [
                {"role": "assistant", "content": greeting},
                {"role": "user", "content": "Yes hi, this is a good time"},
            ],
        },
        timeout=15.0,
    )

    if bedrock_response.status_code == 200:
        ai_text = bedrock_response.json()["content"][0]["text"]
        print(f"  Claude: {ai_text[:150]}...")

        # 5. Convert Claude response to audio
        try:
            parsed = json.loads(ai_text)
            response_text = parsed.get("response", ai_text)
        except json.JSONDecodeError:
            response_text = ai_text

        tts2 = httpx.post(
            "https://api.deepgram.com/v1/speak",
            headers={"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
            json={"text": response_text},
            params={"model": "aura-asteria-en", "encoding": "mulaw", "sample_rate": "8000", "container": "none"},
            timeout=15.0,
        )
        print(f"  TTS reply: {len(tts2.content)} bytes ({len(tts2.content)/8000:.1f}s audio)")
        print(f"\n  Full pipeline works: DB → Greeting → TTS → STT(simulated) → Claude → TTS")
    else:
        raise Exception(f"Bedrock failed: {bedrock_response.status_code}")


# ============================================================
# Run all tests
# ============================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  NEHA HR — SYSTEM TEST SUITE")
    print("=" * 60)

    test("1. Environment Variables", test_env_vars)
    test("2. Supabase Connection", test_supabase)
    test("3. Twilio Connection", test_twilio)
    test("4. Deepgram STT", test_deepgram_stt)
    test("5. Deepgram TTS", test_deepgram_tts)
    test("6. AWS Bedrock (Claude)", test_bedrock)
    test("7. Bedrock Screening Prompt", test_bedrock_screening_prompt)
    test("8. Backend Health Check", test_backend_health)
    test("9. ngrok Tunnel", test_ngrok)
    test("10. Full Pipeline", test_full_pipeline)

    # Summary
    print("\n" + "=" * 60)
    print("  RESULTS SUMMARY")
    print("=" * 60)
    for name, status in results:
        icon = PASS if status == "PASS" else FAIL
        print(f"  {icon} {name}")
        if status != "PASS":
            print(f"         {status}")

    passed = sum(1 for _, s in results if s == "PASS")
    total = len(results)
    print(f"\n  {passed}/{total} tests passed")
    print("=" * 60)

    if passed < total:
        sys.exit(1)
