"""Exit interview call (Call 6) graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Greet employee and explain the exit interview purpose."""
    return {**state, "current_phase": "greeting"}


async def reason_for_leaving(state: ConversationState) -> ConversationState:
    """Ask about primary reason for leaving. Follow up based on response."""
    return {**state, "current_phase": "reason_for_leaving"}


async def manager_experience(state: ConversationState) -> ConversationState:
    """Ask about experience with reporting manager (1-5 rating + details)."""
    return {**state, "current_phase": "manager_experience"}


async def team_experience(state: ConversationState) -> ConversationState:
    """Ask about team dynamics (1-5 rating + details)."""
    return {**state, "current_phase": "team_experience"}


async def culture_rating(state: ConversationState) -> ConversationState:
    """Ask about overall company culture (1-5 rating + specifics)."""
    return {**state, "current_phase": "culture_rating"}


async def suggestions(state: ConversationState) -> ConversationState:
    """Ask for one thing they would change about working here."""
    return {**state, "current_phase": "suggestions"}


async def goodbye(state: ConversationState) -> ConversationState:
    """Thank employee, wish them well. Trigger auto-summary and tagging."""
    return {
        **state,
        "current_phase": "goodbye",
        "should_end_call": True,
        "next_action": "generate_exit_summary",
    }
