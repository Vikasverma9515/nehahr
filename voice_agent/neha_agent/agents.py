"""Neha's agents: one per call type, sharing common tools.

Tools write into ``CallState`` (the session userdata). At the end of the call
``main.py`` sends that state to the backend, which saves, scores and books
exactly as it did for the old Twilio loop (``app/services/call_outcome.py``).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Literal

from livekit.agents import Agent, RunContext, StopResponse, ToolError, function_tool, get_job_context, llm
from pydantic import Field

from . import prompts
from .config import settings

log = logging.getLogger("neha.agent")


@dataclass
class CallState:
    call_id: str
    call_type: str
    channel: str
    context: dict
    extracted: dict = field(default_factory=dict)
    ended_naturally: bool = False
    confirmed_slot_id: int | None = None
    end_reason: str | None = None
    started_at: float = field(default_factory=lambda: datetime.now(timezone.utc).timestamp())
    # Set by main.py: publishes a live snapshot to the room (for the playground).
    on_change: object | None = None

    def update(self, **fields) -> None:
        clean = {k: v for k, v in fields.items() if v is not None and v != ""}
        self.extracted.update(clean)
        if callable(self.on_change):
            self.on_change()


def _state(ctx: RunContext) -> CallState:
    return ctx.userdata


class NehaAgent(Agent):
    """Tools every call type has."""

    def __init__(self, ctx: dict, *, instructions: str | None = None) -> None:
        super().__init__(instructions=instructions or prompts.for_call(ctx))
        self.ctx = ctx

    @function_tool()
    async def end_call(
        self,
        context: RunContext,
        reason: Annotated[
            Literal["completed", "not_interested", "callback_scheduled", "wrong_person", "declined", "other"],
            Field(description="Why the call is ending"),
        ] = "completed",
    ) -> None:
        """Hang up. Call this right after your goodbye line."""
        state = _state(context)
        state.ended_naturally = True
        state.end_reason = reason
        # Let the goodbye finish playing before the line drops.
        await context.wait_for_playout()
        await asyncio.sleep(0.4)
        job = get_job_context()
        job.shutdown(reason=f"end_call:{reason}")

    @function_tool()
    async def schedule_callback(
        self,
        context: RunContext,
        when: Annotated[str, Field(description="ISO 8601 date-time for the callback, in the candidate's local time with offset, e.g. 2026-10-02T18:00:00+05:30")],
        note: Annotated[str, Field(description="Short note, e.g. 'driving, prefers evening'")] = "",
    ) -> str:
        """Book a callback when the candidate asks to talk later."""
        state = _state(context)
        from .backend import BackendClient

        client = BackendClient()
        try:
            await client.request_callback(state.call_id, when, note)
        except Exception as e:
            log.warning("callback booking failed: %s", e)
            raise ToolError("Couldn't book the callback; say the recruiter will call back instead.")
        finally:
            await client.aclose()
        state.update(callback_requested_at=when, callback_note=note)
        return "Callback booked."

    @function_tool()
    async def transfer_to_recruiter(self, context: RunContext) -> str:
        """Connect the candidate to a human recruiter on the phone."""
        state = _state(context)
        if state.channel != "phone" or not settings.hr_transfer_number:
            state.update(human_followup_requested=True)
            return "No recruiter is available live. Promise a human callback within one working day."
        job = get_job_context()
        sip = next(
            (p for p in job.room.remote_participants.values() if p.identity.startswith("sip-")),
            None,
        )
        if not sip:
            return "Transfer isn't possible on this call. Promise a human callback."
        await context.session.say("Sure, connecting you to a recruiter now. One moment.")
        await context.wait_for_playout()
        await job.transfer_sip_participant(sip, settings.hr_transfer_number)
        state.ended_naturally = True
        state.end_reason = "transferred"
        return "Transferred."


class ScreeningAgent(NehaAgent):
    @function_tool()
    async def record_candidate_details(
        self,
        context: RunContext,
        current_location: Annotated[str | None, Field(description="City they live in now")] = None,
        open_to_relocation: bool | None = None,
        work_model_preference: Literal["office", "hybrid", "remote"] | None = None,
        employment_status: Literal["employed", "notice_period", "between_jobs", "fresher", "intern"] | None = None,
        notice_period_days: Annotated[int | None, Field(description="Notice period in days (0 if immediate)")] = None,
        current_ctc_fixed_lpa: Annotated[float | None, Field(description="Current fixed CTC in lakhs per annum")] = None,
        current_ctc_variable_lpa: Annotated[float | None, Field(description="Current variable pay in LPA")] = None,
        expected_ctc_min_lpa: Annotated[float | None, Field(description="Expected CTC (or lower bound) in LPA")] = None,
        expected_ctc_max_lpa: Annotated[float | None, Field(description="Upper bound of expected CTC in LPA")] = None,
        reason_for_leaving: str | None = None,
        interested: bool | None = None,
    ) -> str:
        """Save facts the candidate just shared. Pass only the fields you learned."""
        state = _state(context)
        current_ctc = dict(state.extracted.get("current_ctc") or {})
        if current_ctc_fixed_lpa is not None:
            current_ctc["fixed"] = current_ctc_fixed_lpa
        if current_ctc_variable_lpa is not None:
            current_ctc["variable"] = current_ctc_variable_lpa
        expected = dict(state.extracted.get("expected_ctc") or {})
        if expected_ctc_min_lpa is not None:
            expected["min"] = expected_ctc_min_lpa
        if expected_ctc_max_lpa is not None:
            expected["max"] = expected_ctc_max_lpa
        state.update(
            current_location=current_location,
            open_to_relocation=open_to_relocation,
            work_model_preference=work_model_preference,
            employment_status=employment_status,
            notice_period_days=notice_period_days,
            current_ctc=current_ctc or None,
            expected_ctc=expected or None,
            reason_for_leaving=reason_for_leaving,
            interested=interested,
        )
        return "Saved."

    @function_tool()
    async def record_role_answer(
        self,
        context: RunContext,
        question: Annotated[str, Field(description="The question you asked, short")],
        answer_summary: Annotated[str, Field(description="One-line summary of their answer")],
        rating: Annotated[int, Field(ge=1, le=5, description="1 = weak, 5 = excellent, based on specifics given")],
    ) -> str:
        """Save a role-fit answer."""
        state = _state(context)
        answers = list(state.extracted.get("role_specific_answers") or [])
        answers.append({"question": question, "answer": answer_summary, "rating": rating})
        state.update(role_specific_answers=answers)
        return "Saved."

    @function_tool()
    async def mark_not_interested(
        self, context: RunContext, reason: Annotated[str, Field(description="Their reason, short")]
    ) -> str:
        """The candidate is no longer interested in the role."""
        _state(context).update(interested=False, not_interested_reason=reason)
        return "Noted. Thank them and end the call."


class SchedulingAgent(NehaAgent):
    @function_tool()
    async def confirm_slot(
        self,
        context: RunContext,
        slot_number: Annotated[int, Field(description="Number of the slot from your list")],
    ) -> str:
        """The candidate picked exactly one of the offered slots."""
        state = _state(context)
        slots = (state.context.get("context") or {}).get("slots") or []
        if not 1 <= slot_number <= len(slots):
            raise ToolError(f"Slot {slot_number} doesn't exist; there are {len(slots)} slots.")
        state.confirmed_slot_id = slot_number
        state.update(confirmed_slot_id=slot_number, manual_scheduling_needed=False)
        label = slots[slot_number - 1].get("label") or slots[slot_number - 1].get("start")
        return f"Held: {label}. It will be booked when the call ends; confirm it back to them."

    @function_tool()
    async def no_slot_works(
        self,
        context: RunContext,
        preferred_times: Annotated[str, Field(description="When they said they're free")] = "",
    ) -> str:
        """None of the offered slots work for the candidate."""
        _state(context).update(manual_scheduling_needed=True, preferred_times=preferred_times)
        return "Noted. Say a recruiter will reach out with other times."


class ReminderAgent(NehaAgent):
    @function_tool()
    async def confirm_attendance(self, context: RunContext) -> str:
        """The candidate confirmed they'll attend."""
        _state(context).update(candidate_dropping=False, attendance_confirmed=True)
        return "Confirmed."

    @function_tool()
    async def candidate_cannot_attend(
        self, context: RunContext, reason: Annotated[str, Field(description="Why, short")] = ""
    ) -> str:
        """The candidate can't make it or is dropping out."""
        _state(context).update(candidate_dropping=True, drop_reason=reason)
        return "Noted. Say the team will reach out to reschedule."


class ResultAgent(NehaAgent):
    @function_tool()
    async def result_delivered(self, context: RunContext) -> str:
        """You've clearly told the candidate the outcome."""
        _state(context).update(result_delivered=True)
        return "Noted."


class PreJoiningAgent(NehaAgent):
    @function_tool()
    async def record_engagement(
        self,
        context: RunContext,
        engagement_score: Annotated[int, Field(ge=1, le=10, description="How engaged they sound, 1-10")],
        notes: Annotated[str, Field(description="Brief notes for HR")],
        at_risk: bool = False,
        candidate_dropped: bool = False,
        drop_reason: str = "",
        joining_date_changed: bool = False,
        new_joining_date: Annotated[str, Field(description="YYYY-MM-DD if the date moved")] = "",
    ) -> str:
        """Save how the check-in went."""
        _state(context).update(
            engagement_score=engagement_score, notes=notes, at_risk=at_risk,
            candidate_dropped=candidate_dropped, drop_reason=drop_reason,
            joining_date_changed=joining_date_changed, new_joining_date=new_joining_date,
        )
        return "Saved."


class InboundAgent(NehaAgent):
    @function_tool()
    async def take_message(
        self,
        context: RunContext,
        kind: Literal["reschedule", "withdraw", "question", "message"],
        details: Annotated[str, Field(description="What they asked for, with any times, names or emails")],
    ) -> str:
        """Pass a request or message to the recruiting team."""
        state = _state(context)
        from .backend import BackendClient

        client = BackendClient()
        try:
            await client.candidate_request(state.call_id, kind, details)
        except Exception as e:
            log.warning("take_message failed: %s", e)
            raise ToolError("Couldn't save the message; apologise and ask them to email the recruiter.")
        finally:
            await client.aclose()
        requests = list(state.extracted.get("requests") or [])
        requests.append({"kind": kind, "details": details})
        state.update(requests=requests)
        return "Passed to the team. Tell them a recruiter will get back within one working day."


class MeetAgent(ScreeningAgent):
    """Neha inside a Google Meet: lead, co-interviewer or silent note-taker."""

    def __init__(self, ctx: dict) -> None:
        super().__init__(ctx)
        self.role = (ctx.get("call") or {}).get("neha_role", "lead")
        self.last_speaker: str | None = None

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        text = new_message.text_content or ""
        if self.last_speaker:
            # Meet captions tell us who spoke; the LLM needs that in a panel.
            new_message.content = [f"[{self.last_speaker}] {text}"]
        if self.role == "co_interviewer" and "neha" not in text.lower():
            raise StopResponse()


AGENTS: dict[str, type[NehaAgent]] = {
    "screening": ScreeningAgent,
    "interview": ScreeningAgent,
    "scheduling": SchedulingAgent,
    "reminder": ReminderAgent,
    "reminder_candidate": ReminderAgent,
    "result": ResultAgent,
    "pre_joining": PreJoiningAgent,
    "engagement": PreJoiningAgent,
    "inbound": InboundAgent,
}


def build_agent(ctx: dict) -> NehaAgent:
    call_type = (ctx.get("call") or {}).get("call_type", "screening")
    if (ctx.get("call") or {}).get("channel") == "meet":
        return MeetAgent(ctx)
    return AGENTS.get(call_type, ScreeningAgent)(ctx)
