"""Agent behaviour with a scripted LLM: tools record the right data."""

import pytest
from livekit.agents import AgentSession

from neha_agent.agents import CallState, build_agent
from neha_agent import prompts
from tests.fake_llm import ScriptedLLM, Turn

CTX = {
    "call": {"call_type": "screening", "channel": "playground"},
    "candidate": {"name": "Priya Sharma"},
    "job": {"title": "Backend Engineer", "role_type": "technical", "required_skills": ["Python", "SQL"]},
    "company": {"name": "Acme"},
    "context": {},
}


def _session(llm, ctx=CTX):
    state = CallState(call_id="t1", call_type=ctx["call"]["call_type"], channel="playground", context=ctx)
    return AgentSession(llm=llm, userdata=state), state


async def test_screening_records_ctc_in_lpa():
    llm = ScriptedLLM([
        Turn(tool_calls=[("record_candidate_details", {
            "current_location": "Pune", "current_ctc_fixed_lpa": 12, "current_ctc_variable_lpa": 2,
            "expected_ctc_min_lpa": 16, "expected_ctc_max_lpa": 18, "notice_period_days": 60,
            "employment_status": "employed",
        })]),
        Turn(text="Thanks! And are you open to relocating to Bangalore?"),
    ])
    session, state = _session(llm)
    async with session:
        await session.start(build_agent(CTX))
        result = await session.run(user_input="I'm in Pune, 12 fixed plus 2 variable, expecting 16 to 18, 60 days notice")
        result.expect.next_event().is_function_call(name="record_candidate_details")
        result.expect.next_event().is_function_call_output()
        result.expect.next_event().is_message(role="assistant")

    assert state.extracted["current_location"] == "Pune"
    assert state.extracted["current_ctc"] == {"fixed": 12, "variable": 2}
    assert state.extracted["expected_ctc"] == {"min": 16, "max": 18}
    assert state.extracted["notice_period_days"] == 60


async def test_screening_role_answers_accumulate():
    llm = ScriptedLLM([
        Turn(tool_calls=[("record_role_answer", {"question": "Scaling a DB", "answer_summary": "Sharded Postgres by tenant", "rating": 4})]),
        Turn(text="Nice."),
        Turn(tool_calls=[("record_role_answer", {"question": "Incident", "answer_summary": "Led an outage postmortem", "rating": 3})]),
        Turn(text="Got it."),
    ])
    session, state = _session(llm)
    async with session:
        await session.start(build_agent(CTX))
        await session.run(user_input="We sharded Postgres by tenant.")
        await session.run(user_input="I led the postmortem after an outage.")
    answers = state.extracted["role_specific_answers"]
    assert [a["rating"] for a in answers] == [4, 3]


async def test_scheduling_rejects_unknown_slot_and_accepts_valid_one():
    ctx = {**CTX, "call": {"call_type": "scheduling", "channel": "playground"},
           "context": {"slots": [{"label": "Tuesday 10 AM"}, {"label": "Wednesday 3 PM"}]}}
    llm = ScriptedLLM([
        Turn(tool_calls=[("confirm_slot", {"slot_number": 5})]),
        Turn(tool_calls=[("confirm_slot", {"slot_number": 2})]),
        Turn(text="Perfect, Wednesday at 3 PM it is."),
    ])
    session, state = _session(llm, ctx)
    async with session:
        await session.start(build_agent(ctx))
        result = await session.run(user_input="Wednesday afternoon works")
        result.expect.contains_function_call(name="confirm_slot")
    assert state.confirmed_slot_id == 2
    assert state.extracted["manual_scheduling_needed"] is False


def test_prompts_cover_every_call_type():
    for call_type in ["screening", "scheduling", "reminder", "result", "pre_joining", "engagement"]:
        ctx = {**CTX, "call": {"call_type": call_type, "channel": "phone"}}
        text = prompts.for_call(ctx)
        assert "Neha" in text and "end_call" in text
        assert "JSON" not in text.split("# How you speak")[0]
        assert prompts.greeting(ctx)


def test_screening_prompt_uses_configured_questions():
    ctx = {**CTX, "screening_config": {"questions": [{"text": "Tell me about a Kafka pipeline you built"}],
                                       "knockouts": ["Must be able to work from Bangalore"]}}
    text = prompts.for_call(ctx)
    assert "Kafka pipeline" in text and "Bangalore" in text


def test_latency_tracker_groups_by_speech_id():
    from livekit.agents.metrics import EOUMetrics, LLMMetrics, TTSMetrics
    from neha_agent.telemetry import LatencyTracker

    t = LatencyTracker()
    t.add(EOUMetrics(timestamp=0, end_of_utterance_delay=0.3, transcription_delay=0.1,
                     on_user_turn_completed_delay=0, speech_id="s1"))
    t.add(LLMMetrics(label="l", request_id="r", timestamp=0, duration=1, ttft=0.45, cancelled=False,
                     completion_tokens=1, prompt_tokens=1, prompt_cached_tokens=0, total_tokens=2,
                     tokens_per_second=1, speech_id="s1"))
    row = t.add(TTSMetrics(label="t", request_id="r", timestamp=0, ttfb=0.12, duration=1, audio_duration=1,
                           cancelled=False, characters_count=3, streamed=True, speech_id="s1"))
    assert row["total_ms"] == 870
    assert t.summary()["p50_ms"] == 870


async def test_end_call_marks_natural_end_and_shuts_down():
    from livekit.agents.testing import fake_job_context

    llm = ScriptedLLM([
        Turn(text="Thanks Priya, have a great day!", tool_calls=[("end_call", {"reason": "completed"})]),
    ])
    session, state = _session(llm)
    with fake_job_context() as job:
        shutdown_reasons = []
        job.shutdown = lambda reason="": shutdown_reasons.append(reason)
        async with session:
            await session.start(build_agent(CTX))
            await session.run(user_input="No more questions, thanks!")
    assert state.ended_naturally and state.end_reason == "completed"
    assert shutdown_reasons == ["end_call:completed"]
