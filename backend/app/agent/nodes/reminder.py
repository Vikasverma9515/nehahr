"""Pre-interview reminder call (Call 3) graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Remind candidate about upcoming interview."""
    return {**state, "current_phase": "greeting"}


async def confirm_attendance(state: ConversationState) -> ConversationState:
    """Confirm the candidate will attend."""
    return {**state, "current_phase": "confirm_attendance"}


def route_after_attendance_check(state: ConversationState) -> str:
    """Route based on whether candidate is attending."""
    # TODO: Analyze response for attendance confirmation
    return "attending"


async def share_logistics(state: ConversationState) -> ConversationState:
    """Share interview logistics (time, location, interviewer, docs)."""
    return {**state, "current_phase": "logistics"}


async def goodbye(state: ConversationState) -> ConversationState:
    """Wish candidate good luck and end call."""
    return {**state, "current_phase": "goodbye", "should_end_call": True}
