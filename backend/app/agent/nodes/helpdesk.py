"""HR helpdesk call graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Greet employee and collect name/ID."""
    return {**state, "current_phase": "greeting"}


async def identify_query(state: ConversationState) -> ConversationState:
    """Ask what they need help with. Classify into one of 5 buckets:

    1. Team/Manager/Work Related
    2. Time & Attendance
    3. Payroll Related
    4. HR Documentation
    5. IT Helpdesk
    """
    return {**state, "current_phase": "identify_query"}


async def resolve_or_escalate(state: ConversationState) -> ConversationState:
    """Either resolve the query directly or escalate to the right team.

    Factual/process queries → resolve with knowledge base answer.
    Complex issues → create ticket, escalate with full context.
    """
    return {**state, "current_phase": "resolve_or_escalate"}


async def anything_else(state: ConversationState) -> ConversationState:
    """Ask if the employee has any other queries."""
    return {**state, "current_phase": "anything_else"}


def route_after_anything_else(state: ConversationState) -> str:
    """Route based on whether employee has more queries."""
    # TODO: Analyze response
    return "done"


async def goodbye(state: ConversationState) -> ConversationState:
    """End helpdesk call."""
    return {**state, "current_phase": "goodbye", "should_end_call": True}
