"""Post-interview result call (Call 4) graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Greet candidate and set context for result communication."""
    return {**state, "current_phase": "greeting"}


async def communicate_result(state: ConversationState) -> ConversationState:
    """Communicate interview result: pass/fail/hold.

    - Pass + more rounds: explain next round, re-enter scheduling
    - Pass + final: congratulate, hand off to human HR
    - Hold: set expectations on timeline
    - Fail: polite close with encouragement
    """
    return {**state, "current_phase": "communicate_result"}


async def goodbye(state: ConversationState) -> ConversationState:
    """End the result call."""
    return {**state, "current_phase": "goodbye", "should_end_call": True}
