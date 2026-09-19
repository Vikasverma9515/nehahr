"""AI conversation manager — Claude via AWS Bedrock bearer token.

Uses the bearer token provided by your team to call Claude
through the Bedrock runtime API directly via httpx.
"""

import asyncio
import json
import httpx

from app.config import settings


# Haiku for real-time voice calls (fast, ~500ms-1s inference)
# Sonnet for scoring/summary (slower but more accurate — not time-critical)
BEDROCK_HAIKU_URL = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke"
BEDROCK_SONNET_URL = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/invoke"

# Streaming endpoint for real-time responses
BEDROCK_HAIKU_STREAM_URL = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke-with-response-stream"

# Persistent HTTP client — reused across all calls (avoids TLS handshake per request)
_http_client: httpx.AsyncClient | None = None
_http_client_lock = asyncio.Lock()

async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    async with _http_client_lock:
        if _http_client is None or _http_client.is_closed:
            _http_client = httpx.AsyncClient(
                timeout=15.0,
                http2=True,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
    return _http_client


async def call_claude(system: str, messages: list[dict], max_tokens: int = 300, use_sonnet: bool = False) -> str:
    """Call Claude via Bedrock REST API (non-streaming).

    Uses Haiku by default (fast, ~500ms-1s for voice calls).
    Pass use_sonnet=True for scoring/summary where accuracy > speed.

    Uses Anthropic prompt caching on the system prompt — the long system
    prompt (~3k chars) is cached for 5 min on Anthropic's side. Subsequent
    calls with the same system prompt skip the prefix computation, cutting
    TTFT by 200-400ms.
    """
    url = BEDROCK_SONNET_URL if use_sonnet else BEDROCK_HAIKU_URL
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        # Use cache_control on system prompt so it's cached across turns
        "system": [
            {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
        ],
        "messages": messages,
    }

    try:
        client = await _get_http_client()
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.aws_bearer_token_bedrock}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        print(f"[BEDROCK] Status: {response.status_code} ({'sonnet' if use_sonnet else 'haiku'})")
        if response.status_code != 200:
            print(f"[BEDROCK ERROR] {response.text[:200]}")
            return '{"response": "I apologize, I am having a brief technical issue. Could you please repeat that?", "phase": "error", "extracted": {}, "should_end": false}'
        data = response.json()
        return data["content"][0]["text"]
    except Exception as e:
        print(f"[BEDROCK ERROR] {e}")
        return '{"response": "I apologize, could you please repeat that?", "phase": "error", "extracted": {}, "should_end": false}'


async def call_claude_streaming(
    system: str,
    messages: list[dict],
    max_tokens: int = 300,
    on_sentence=None,
) -> str:
    """Call Claude via Bedrock streaming with sentence-level TTS hooks.

    As Claude streams JSON, we extract the value of the "response" field
    character-by-character. Whenever we see a sentence boundary (. ! ?),
    we fire on_sentence(sentence) so TTS can start immediately without
    waiting for Claude to finish generating.

    This cuts perceived latency from ~2s to ~500ms for the first audio.

    Returns the full raw response for final JSON parsing.
    """
    import json as _json
    import re

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
    }

    full_text = ""
    # Streaming JSON parser state for the "response" field
    in_response_value = False
    response_ended = False
    response_so_far = ""  # accumulated chars inside the response string
    spoken_so_far = ""    # text already sent to on_sentence

    async def _flush_sentences(final: bool = False):
        """Send any complete sentences from response_so_far to on_sentence."""
        nonlocal spoken_so_far
        if not on_sentence:
            return
        unspoken = response_so_far[len(spoken_so_far):]
        if not unspoken:
            return
        # Find all sentence boundaries
        last_boundary = -1
        for m in re.finditer(r'[.!?](?:\s|$)', unspoken):
            last_boundary = m.end()
        if last_boundary > 0:
            sentence = unspoken[:last_boundary].strip()
            spoken_so_far += unspoken[:last_boundary]
            if sentence:
                try:
                    await on_sentence(sentence)
                except Exception as e:
                    print(f"[BEDROCK STREAM] on_sentence error: {e}")
        elif final and unspoken.strip():
            # End of stream — send whatever's left
            spoken_so_far += unspoken
            try:
                await on_sentence(unspoken.strip())
            except Exception as e:
                print(f"[BEDROCK STREAM] final on_sentence error: {e}")

    try:
        client = await _get_http_client()
        async with client.stream(
            "POST",
            BEDROCK_HAIKU_STREAM_URL,
            headers={
                "Authorization": f"Bearer {settings.aws_bearer_token_bedrock}",
                "Content-Type": "application/json",
            },
            json=body,
        ) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                print(f"[BEDROCK STREAM] Error {response.status_code}: {error_body[:200]}")
                return '{"response": "I apologize, could you please repeat that?", "phase": "error", "extracted": {}, "should_end": false}'

            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                if line.startswith("data:"):
                    line = line[5:].strip()
                if not line:
                    continue

                try:
                    event = _json.loads(line)
                except Exception:
                    continue

                if event.get("type") != "content_block_delta":
                    continue

                delta = event.get("delta", {})
                text = delta.get("text", "")
                if not text:
                    continue

                full_text += text

                if response_ended:
                    continue  # already finished the response field

                # Detect start of "response":"..." value
                if not in_response_value:
                    m = re.search(r'"response"\s*:\s*"', full_text)
                    if m:
                        in_response_value = True
                        # Capture any text already past the opening quote
                        response_so_far = full_text[m.end():]
                else:
                    response_so_far += text

                # Check if response value has closed (unescaped ")
                if in_response_value:
                    end_match = re.search(r'(?<!\\)"', response_so_far)
                    if end_match:
                        # Trim to just the value content
                        response_so_far = response_so_far[:end_match.start()]
                        response_ended = True
                        # Unescape any JSON escapes
                        response_so_far = response_so_far.replace('\\"', '"').replace('\\n', ' ').replace('\\\\', '\\')
                        await _flush_sentences(final=True)
                    else:
                        # Still streaming — fire any complete sentence
                        await _flush_sentences(final=False)

            # Stream done — flush anything remaining
            if not response_ended:
                await _flush_sentences(final=True)

    except Exception as e:
        print(f"[BEDROCK STREAM] Error: {e}")
        if not full_text:
            return '{"response": "I apologize, could you please repeat that?", "phase": "error", "extracted": {}, "should_end": false}'

    print(f"[BEDROCK] Streamed {len(full_text)} chars (haiku)")
    return full_text


def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` markdown code fences from Claude's output."""
    text = text.strip()
    if text.startswith("```"):
        # Split on ``` — the middle section is the content
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            # Strip leading language hint like "json\n"
            if text.startswith("json"):
                text = text[4:]
            elif text.startswith("JSON"):
                text = text[4:]
    return text.strip()


def _try_parse_json(raw_text: str) -> dict | None:
    """Try to parse Claude's response as JSON, handling markdown fences."""
    cleaned = _strip_markdown_fences(raw_text)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return None


def _parse_claude_response(raw_text: str) -> str:
    """Extract the spoken 'response' text from Claude's JSON output.

    Handles multiple formats Claude might return:
    1. Clean JSON: {"response": "Hi!", ...}
    2. Markdown-wrapped: ```json{"response": "Hi!", ...}```
    3. Text before JSON: "Sure thing!\n{"response": "Sure thing!", ...}"
    4. Multiple JSON objects in output
    """
    import re

    # Try 1: Direct JSON parse
    parsed = _try_parse_json(raw_text)
    if parsed and "response" in parsed:
        return str(parsed["response"])

    # Try 2: Strip markdown fences then parse
    cleaned = _strip_markdown_fences(raw_text)
    parsed = _try_parse_json(cleaned)
    if parsed and "response" in parsed:
        return str(parsed["response"])

    # Try 3: Find a JSON object anywhere in the text (handles text + JSON mix)
    json_match = re.search(r'\{[^{}]*"response"\s*:\s*"[^"]*"[^{}]*\}', raw_text, re.DOTALL)
    if json_match:
        parsed = _try_parse_json(json_match.group())
        if parsed and "response" in parsed:
            return str(parsed["response"])

    # Try 4: Find JSON with nested objects (extracted field has {})
    json_match = re.search(r'\{.*"response"\s*:\s*".*?".*\}', raw_text, re.DOTALL)
    if json_match:
        parsed = _try_parse_json(json_match.group())
        if parsed and "response" in parsed:
            return str(parsed["response"])

    # Fallback: if text contains curly braces, it's corrupted — don't speak it
    if "{" in cleaned and "response" in cleaned:
        return "Could you say that again?"

    # Clean text with no JSON — safe to speak
    if cleaned and not cleaned.startswith("{"):
        return cleaned

    return "Could you say that again?"


def _format_slots_for_prompt(slots: list[dict]) -> str:
    """Format available slots grouped by day so Claude can offer day→time variety.

    Example output:
      Tuesday, April 14:
        1. 10 AM (morning)
        2. 2 PM (afternoon)
      Wednesday, April 15:
        3. 11 AM (morning)
        ...
    """
    if not slots:
        return "(No slots available)"

    # Group by day, preserving order (slots are already sorted chronologically)
    by_day: dict[str, list[tuple[int, dict]]] = {}
    for i, slot in enumerate(slots, start=1):
        day = slot.get("day") or slot.get("label", "unknown").split(" at ")[0]
        by_day.setdefault(day, []).append((i, slot))

    lines = []
    for day, day_slots in by_day.items():
        lines.append(f"  {day}:")
        for idx, slot in day_slots:
            time = slot.get("time") or slot.get("label", "").split(" at ")[-1]
            period = slot.get("period", "")
            suffix = f" ({period})" if period else ""
            lines.append(f"    {idx}. {time}{suffix}")
    return "\n".join(lines)


def _format_slots_summary(slots: list[dict]) -> str:
    """Short summary string for the AI to drop into conversation, e.g.
    'Tuesday morning or afternoon, Wednesday morning, or Thursday morning'."""
    if not slots:
        return "no openings right now"
    by_day: dict[str, list[str]] = {}
    for slot in slots:
        day = slot.get("day") or "unknown"
        period = slot.get("period") or slot.get("time") or ""
        by_day.setdefault(day, []).append(period)
    parts = []
    for day, periods in by_day.items():
        # Just the weekday (first word of "Tuesday, April 14")
        weekday = day.split(",")[0]
        if len(periods) == 2:
            parts.append(f"{weekday} morning or afternoon")
        elif periods:
            parts.append(f"{weekday} {periods[0]}")
        else:
            parts.append(weekday)
    return ", ".join(parts)


SCREENING_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are on a live phone call with a candidate. Speak naturally, like a real recruiter.

## Your personality
- Professional, warm, conversational — never robotic
- Keep responses SHORT (1-3 sentences max) — this is a phone call, not an essay
- Use the candidate's name occasionally
- If they seem confused, rephrase patiently

## Candidate info
Name: {candidate_name}
Job: {job_title}
Role type: {role_type}

## Call structure
You are conducting a screening call. Go through these phases IN ORDER:
1. GREETING - Introduce yourself, confirm you're speaking with the right person
2. INTEREST - Confirm they're still interested in the role
3. DEMOGRAPHICS - Ask about: current location, relocation preference, work model preference, employment status
4. COMPENSATION - Ask about: current CTC (fixed + variable), expected CTC range, notice period
5. ROLE FIT - Based on role type, ask 2-3 relevant questions about their experience
6. CLOSING - Thank them, explain next steps (recruiter will follow up in 2-3 days)

## Rules
- Ask ONE question at a time
- After each candidate response, move to the next question
- If they decline to answer, say "No problem" and move on
- When all questions are done, move to CLOSING
- After closing, set should_end to true

## Response format — CRITICAL
Respond with ONLY a raw JSON object. Do NOT wrap it in markdown code fences (no ```json, no ```).
Do NOT add any text before or after the JSON. The first character of your response must be `{{` and the last must be `}}`.

Format:
{{"response": "what Neha says next", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

The "extracted" object should contain any data you picked up from the candidate's last response.
Valid keys: current_location, open_to_relocation, work_model_preference, employment_status,
notice_period_days, current_ctc, expected_ctc, reason_for_leaving, role_specific_answers

## CRITICAL — CTC must be in LPA (lakhs per annum) as numbers
- "16 lakhs" → {{"fixed": 16}}
- "16 LPA fixed + 2 LPA variable" → {{"fixed": 16, "variable": 2}}
- "20 to 25 lakhs" → {{"min": 20, "max": 25}}
- "30,000 per month" → convert to 3.6 LPA → {{"fixed": 3.6}} (monthly rupees * 12 / 100000)
- Never store rupees directly — always convert to LPA.

## CRITICAL — Employment status values
- "intern" — currently interning/trainee/apprentice
- "fresher" — new graduate, no full-time experience
- "employed" — full-time at another company
- "notice_period" — serving notice at a full-time job
- "between_jobs" — currently unemployed
Interns and freshers are scored differently (their stipend is not a real CTC).

Example:
{{"response": "Great, and what's your current CTC? A rough breakup of fixed and variable would be helpful.", "phase": "compensation", "extracted": {{"current_location": "Mumbai", "open_to_relocation": true}}, "should_end": false}}
"""

SCHEDULING_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are on a live phone call with {candidate_name} to schedule their interview for the {job_title} role.

## Your personality
- Warm, professional, conversational — sound like a real recruiter, not a menu
- Keep responses SHORT (1-2 sentences max) — this is a phone call
- Use candidate's name occasionally
- NEVER read out slot numbers like "option 1, option 2". Speak naturally.

## Interview details
- Role: {job_title}
- Format: {interview_type}
- Duration: {duration_minutes} minutes

## Available slots (REAL free slots on the interviewer's calendar)
These are numbered so you can reference them internally. The candidate cannot see numbers — speak in days and times.

{slots_list}

Summary you can use to describe flexibility in one breath: {slots_summary}

## CRITICAL — NEVER reveal the interviewer's identity
- Never say the interviewer's name, email, or title out loud. Not in the greeting, not in the confirm, not in the close. Not even if the candidate asks.
- Say "the hiring manager", "the interviewer", "the team", or "our panel" instead.
- If the candidate asks "who will I be interviewing with?", reply: "You'll get all the details in the calendar invite we send right after this call." Then keep going.
- Company policy: interviewer identity is disclosed only via the calendar invite — never verbally.

## Call structure — keep it SHORT, under 90 seconds total
1. ANNOUNCE — Confirm you're speaking with {candidate_name}, share the good news (shortlisted for {job_title}), ask if they have a minute.
2. ASK_PREFERENCE — Don't just dump every slot. Instead, tell them you have several options across the week and ask what day or time works best for them. Example: "We have openings on {slots_summary}. Do any of those days work better for you?"
3. NARROW — Based on their answer, offer the 1-2 specific times that match their stated preference. Example: "Great, on Tuesday I can do either 10 AM or 2 PM — which is easier?"
4. CONFIRM_SLOT — When they pick, confirm back WITHOUT naming the interviewer: "Perfect, [day and time]. It'll be a {duration_minutes}-minute {interview_type} interview, and I'll send you the calendar invite with the meeting link right after this call."
5. CLOSE — "Thanks {candidate_name}, have a great day!" — and immediately end.

## CRITICAL slot-matching rules
When the candidate expresses a pick — direct ("Tuesday 10 AM works"), positional ("the morning one"), relative ("the earlier Wednesday"), or day-only ("Tuesday is better"):
1. Match their intent against the numbered slots above.
2. If multiple slots match a loose intent (e.g. "Tuesday"), ask which time.
3. Once locked to exactly one slot, set `extracted.confirmed_slot_id = <that number>` and move to CONFIRM_SLOT → CLOSE.

## CRITICAL — ending the call
- As soon as you finish your CLOSE line (either confirmed or manual-fallback), set `should_end = true`. Do NOT keep waiting.
- If the candidate clearly rejects EVERY offered day/time and no negotiation is possible, do NOT keep re-asking. After at most ONE attempt to clarify, say: "No problem, our recruiter will reach out directly to find a better time. Thanks for your time today!" Then set `extracted.manual_scheduling_needed = true` and `should_end = true`.
- If the candidate says they can't talk, the call is over, goodbye, or similar — say a quick sign-off and set `should_end = true`.
- NEVER loop. If you've already presented slots and heard "no" twice, end the call with manual fallback. Do not ask a third time.

## Response format (CRITICAL)
Return ONLY a raw JSON object. No markdown, no ```. First char must be `{{`, last must be `}}`.

Format:
{{"response": "what Neha says next", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

Valid phases: announce, ask_preference, narrow, confirm_slot, close, manual_fallback
Valid extracted keys: confirmed_slot_id (integer matching a numbered slot), manual_scheduling_needed (boolean)
"""

REMINDER_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are on a short phone call with {candidate_name} to remind them about their interview.

## Your personality
- Warm, professional, brief — this is a 30-second reminder, not a conversation
- Keep responses SHORT (1-2 sentences)

## Interview details
- Role: {job_title}
- Scheduled: {interview_time}
- Format: {interview_type}
- Duration: {duration_minutes} minutes

## Call structure — under 60 seconds total
1. GREETING — "Hi {candidate_name}, this is Neha from the recruiting team. I'm calling to remind you about your interview today."
2. CONFIRM — Share the time and format. Ask: "Will you be able to make it?"
3. LOGISTICS — If yes: "Please join 2-3 minutes early. You should have the meeting link in your email. All the best!"
   If no/unsure: "No problem, I'll let the team know. Someone will reach out to reschedule." Set `extracted.candidate_dropping = true`.
4. CLOSE — End quickly. Set `should_end = true`.

## Response format (CRITICAL)
Return ONLY a raw JSON object. No markdown. First char must be `{{`, last must be `}}`.

Format:
{{"response": "what Neha says", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

Valid phases: greeting, confirm, logistics, close
Valid extracted keys: candidate_dropping (boolean — true if they can't make it)
"""

RESULT_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are calling {candidate_name} to share the outcome of their interview for the {job_title} role.

## Your personality
- Warm, empathetic, professional
- Keep responses SHORT (1-2 sentences)
- Be genuinely congratulatory for passes, genuinely kind for rejections

## Interview result: {result}

## Call structure
1. GREETING — "Hi {candidate_name}, this is Neha from the recruiting team. I'm calling about your recent interview for the {job_title} role."

2. RESULT — Branch based on result:
   - If PASS: "Great news — the team was really impressed with your interview! We'd like to move forward with your candidacy. Our HR team will be in touch shortly with the next steps and offer details."
   - If HOLD: "Thanks for taking the time to interview with us. The team is still finalizing their decision and we'll get back to you within the next few days. We appreciate your patience."
   - If FAIL: "Thank you for interviewing with us. After careful consideration, the team has decided to move forward with other candidates at this time. We really appreciate your time and interest in joining us, and we encourage you to apply for future openings that match your profile."

3. CLOSE — "Do you have any questions?" → answer briefly if they do → "Thanks {candidate_name}, have a great day!" → set `should_end = true`.

## CRITICAL rules
- Never share specific feedback or scores verbally. If they ask for detailed feedback, say: "I'll have the recruiter send you a summary via email."
- Be respectful regardless of outcome.
- Keep the call under 90 seconds.

## Response format (CRITICAL)
Return ONLY a raw JSON object. No markdown. First char must be `{{`, last must be `}}`.

Format:
{{"response": "what Neha says", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

Valid phases: greeting, result, close
Valid extracted keys: (none expected)
"""

PRE_JOINING_A_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are calling {candidate_name} for a pre-joining confirmation — they are joining on {joining_date} for the {job_title} role.

## Your personality
- Warm, excited, welcoming — they're about to join the team!
- Keep responses SHORT (1-2 sentences)
- Make them feel valued

## Call structure — under 90 seconds
1. GREETING — "Hi {candidate_name}, this is Neha from the recruiting team! I'm calling to make sure everything's on track for your joining on {joining_date}."
2. CONFIRM — "Are we still good for {joining_date}?"
   - If yes → great, move to logistics
   - If no / taken another offer → note reason, set `extracted.candidate_dropped = true`
   - If delay needed → note new date, set `extracted.joining_date_changed = true` and `extracted.new_joining_date`
3. LOGISTICS — "Here's what you need for Day 1:
   - Arrive by 10 AM at our office
   - Bring your original ID proof, address proof, and educational certificates
   - You'll be reporting to the HR team on arrival
   - Dress code is smart casual"
4. CLOSE — "We're really looking forward to having you on the team! See you on {joining_date}. Have a great day!"

## CRITICAL — detecting dropouts
- If they say "I've accepted another offer" / "I won't be joining" / "I changed my mind":
  → Ask the reason politely (once), note it, set `extracted.candidate_dropped = true` and `extracted.drop_reason`
  → Say: "I understand. Thank you for letting us know. We wish you all the best!"
  → Set `should_end = true`
- If they sound hesitant / non-committal:
  → Set `extracted.at_risk = true`

## Response format (CRITICAL)
Return ONLY a raw JSON object. First char must be `{{`, last must be `}}`.

Format:
{{"response": "what Neha says", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

Valid phases: greeting, confirm, logistics, close
Valid extracted keys: candidate_dropped (bool), drop_reason (string), at_risk (bool), joining_date_changed (bool), new_joining_date (string)
"""

PRE_JOINING_B_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are calling {candidate_name} for a routine engagement check-in. They accepted the {job_title} offer and are joining on {joining_date}, but they're still serving their notice period.

## Your personality
- Friendly, warm, conversational — like a colleague checking in, not a formal call
- Keep it natural and SHORT (1-2 sentences per turn)
- Show genuine interest in how they're doing

## Context
- This is a regular check-in call (every 2-3 weeks during notice period)
- Goal: keep them engaged, detect disengagement or competing offers early
- Previous engagement score: {engagement_score}/10

## Call structure — under 2 minutes
1. GREETING — "Hey {candidate_name}! Just checking in — how's everything going?"
2. CHECK_LWD — "Is your last working day still on track? Any changes to the timeline?"
3. ENGAGEMENT — Ask naturally about what they're up to:
   - "Excited about starting?"
   - "Any questions about the role or team?"
   - "Anything we can help with before you join?"
4. DETECT — Listen for signals:
   - Enthusiastic, asks questions → engaged (score 7-10)
   - Neutral, short answers → moderate (score 4-6)
   - Evasive, mentions "other opportunities", delayed responses → at risk (score 1-3)
5. CLOSE — "Great chatting with you! We'll check in again in a couple of weeks. Take care!"

## CRITICAL — what to extract
After the conversation, assess:
- `engagement_score`: 1-10 based on how engaged they sounded
- `at_risk`: true if competing offers mentioned, evasive about joining, or LWD changed
- `lwd_on_track`: true/false
- `notes`: brief summary of the conversation for HR

## Response format (CRITICAL)
Return ONLY a raw JSON object. First char must be `{{`, last must be `}}`.

Format:
{{"response": "what Neha says", "phase": "current_phase", "extracted": {{}}, "should_end": false}}

Valid phases: greeting, check_lwd, engagement, close
Valid extracted keys: engagement_score (int 1-10), at_risk (bool), lwd_on_track (bool), notes (string), candidate_dropped (bool), drop_reason (string)
"""

GENERIC_SYSTEM_PROMPT = """You are Neha, an AI HR agent for the hiring company.
You are on a call with {candidate_name} regarding the {job_title} position.
Call type: {call_type}

Keep responses short and professional. This is a phone call.

Respond with ONLY a JSON object:
{{"response": "what Neha says", "phase": "current_phase", "extracted": {{}}, "should_end": false}}
"""


class ConversationManager:
    """Manages one conversation with Claude via Bedrock."""

    def __init__(self, call_type: str, candidate: dict, context: dict | None = None):
        """
        Args:
            call_type: "screening" | "scheduling" | etc.
            candidate: candidate row from DB (with jobs relation)
            context: extra call-specific context, e.g. for scheduling:
                {"slots": [...], "interviewer_name": "...", "interview_type": "...", "duration_minutes": 60}
        """
        self.call_type = call_type
        self.candidate = candidate
        self.context = context or {}
        self.messages: list[dict] = []
        self.extracted_data: dict = {}
        self.should_end = False

        # Build system prompt
        candidate_name = candidate.get("name", "the candidate")
        job = candidate.get("jobs") or {}
        job_title = job.get("title", "the open position") if isinstance(job, dict) else "the open position"
        role_type = job.get("role_type", "general") if isinstance(job, dict) else "general"

        if call_type == "screening":
            self.system_prompt = SCREENING_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                role_type=role_type,
            )
        elif call_type == "scheduling":
            slots = self.context.get("slots", [])
            slots_list = _format_slots_for_prompt(slots)
            slots_summary = _format_slots_summary(slots)
            self.system_prompt = SCHEDULING_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                interview_type=self.context.get("interview_type", "video"),
                duration_minutes=self.context.get("duration_minutes", 60),
                slots_list=slots_list,
                slots_summary=slots_summary,
            )
        elif call_type == "reminder":
            self.system_prompt = REMINDER_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                interview_time=self.context.get("interview_time", "today"),
                interview_type=self.context.get("interview_type", "video"),
                duration_minutes=self.context.get("duration_minutes", 60),
            )
        elif call_type == "result":
            self.system_prompt = RESULT_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                result=self.context.get("result", "hold"),
            )
        elif call_type == "pre_joining":
            self.system_prompt = PRE_JOINING_A_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                joining_date=self.context.get("joining_date", "your joining date"),
            )
        elif call_type == "engagement":
            self.system_prompt = PRE_JOINING_B_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                joining_date=self.context.get("joining_date", "your joining date"),
                engagement_score=self.context.get("engagement_score", "N/A"),
            )
        else:
            self.system_prompt = GENERIC_SYSTEM_PROMPT.format(
                candidate_name=candidate_name,
                job_title=job_title,
                call_type=call_type,
            )

    def get_greeting(self) -> str:
        """Generate the opening greeting."""
        candidate_name = self.candidate.get("name", "")
        job = self.candidate.get("jobs") or {}
        job_title = job.get("title", "the open position") if isinstance(job, dict) else "the open position"

        if self.call_type == "screening":
            greeting = (
                f"Hi, am I speaking with {candidate_name}? "
                f"This is Neha calling from the recruiting team. "
                f"I'm reaching out about the {job_title} position you applied for. "
                f"Is this a good time to talk?"
            )
        elif self.call_type == "scheduling":
            greeting = (
                f"Hi, am I speaking with {candidate_name}? "
                f"This is Neha from the recruiting team. Great news — you've been shortlisted for the {job_title} role, "
                f"and I'm calling to set up your interview. Do you have a minute?"
            )
        elif self.call_type == "reminder":
            interview_time = self.context.get("interview_time", "today")
            greeting = (
                f"Hi {candidate_name}, this is Neha from the recruiting team. "
                f"Just a quick reminder — your interview for the {job_title} role is coming up {interview_time}. "
                f"Will you be able to make it?"
            )
        elif self.call_type == "result":
            greeting = (
                f"Hi, am I speaking with {candidate_name}? "
                f"This is Neha from the recruiting team. "
                f"I'm calling about your recent interview for the {job_title} role."
            )
        elif self.call_type == "pre_joining":
            joining_date = self.context.get("joining_date", "your joining date")
            greeting = (
                f"Hi {candidate_name}! This is Neha from the recruiting team. "
                f"I'm calling to make sure everything's on track for your joining on {joining_date}. "
                f"Are we still good?"
            )
        elif self.call_type == "engagement":
            greeting = (
                f"Hey {candidate_name}! It's Neha from the recruiting team. "
                f"Just checking in — how's everything going on your end?"
            )
        else:
            greeting = (
                f"Hi {candidate_name}, this is Neha from the recruiting team. "
                f"How are you doing today?"
            )

        self.messages.append({"role": "assistant", "content": greeting})
        return greeting

    async def respond(self, candidate_text: str, on_sentence=None) -> str | None:
        """Process candidate speech and generate AI response.

        If on_sentence is provided, uses streaming — each complete sentence
        in Claude's "response" field is sent to the callback as it arrives.
        TTS can start speaking while Claude is still generating the rest.
        """
        self.messages.append({"role": "user", "content": candidate_text})

        if on_sentence:
            raw_text = await call_claude_streaming(
                system=self.system_prompt,
                messages=self.messages,
                max_tokens=300,
                on_sentence=on_sentence,
            )
        else:
            raw_text = await call_claude(
                system=self.system_prompt,
                messages=self.messages,
                max_tokens=300,
            )

        ai_response = _parse_claude_response(raw_text)

        # Update extracted data and should_end from the parsed JSON
        parsed = _try_parse_json(raw_text)
        if parsed:
            extracted = parsed.get("extracted", {})
            if extracted:
                self.extracted_data.update(extracted)
            self.should_end = parsed.get("should_end", False)

        self.messages.append({"role": "assistant", "content": ai_response})
        return ai_response

    def get_summary(self) -> str | None:
        """Generate a summary of the call (sync, called at end)."""
        if not self.messages:
            return None

        transcript = "\n".join(
            f"{'Neha' if m['role'] == 'assistant' else 'Candidate'}: {m['content']}"
            for m in self.messages
        )

        # Sync call for end-of-call summary — use Haiku (fast, summary doesn't need Sonnet)
        import httpx as httpx_sync
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 200,
            "messages": [{
                "role": "user",
                "content": f"Summarize this screening call in 2-3 sentences. Focus on key findings (location, CTC, notice period, fit).\n\n{transcript}",
            }],
        }
        with httpx_sync.Client() as client:
            response = client.post(
                BEDROCK_HAIKU_URL,
                headers={
                    "Authorization": f"Bearer {settings.aws_bearer_token_bedrock}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"].strip()

    def get_extracted_data(self) -> dict:
        """Return all structured data extracted during the call."""
        return self.extracted_data
