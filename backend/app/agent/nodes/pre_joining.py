"""Pre-joining confirmation call (Call 5) graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Greet candidate and congratulate on offer."""
    return {**state, "current_phase": "greeting"}


async def confirm_joining(state: ConversationState) -> ConversationState:
    """Confirm candidate is still joining as planned."""
    # TODO: Detect withdrawal, disengagement, or competing offers
    return {**state, "current_phase": "confirm_joining"}


def route_after_confirmation(state: ConversationState) -> str:
    """Route based on joining confirmation and notice period track."""
    # TODO: Determine track based on candidate response
    return "confirmed_short"


async def engagement_check(state: ConversationState) -> ConversationState:
    """Track B: Long notice period engagement check-in.

    Gauge: enthusiasm, responsiveness, competing offers, LWD changes.
    Score engagement and flag disengagement to HR.
    """
    return {**state, "current_phase": "engagement_check"}


async def day1_logistics(state: ConversationState) -> ConversationState:
    """Share Day 1 joining logistics."""
    return {**state, "current_phase": "day1_logistics"}


async def goodbye(state: ConversationState) -> ConversationState:
    """End pre-joining call."""
    return {**state, "current_phase": "goodbye", "should_end_call": True}
