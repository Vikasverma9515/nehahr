"""Main LangGraph state machine for Neha's call flows."""

from langgraph.graph import StateGraph, END

from app.agent.state import ConversationState
from app.agent.nodes import screening, scheduling, reminder, result, pre_joining, exit_call, helpdesk


def build_screening_graph() -> StateGraph:
    """Build the screening call (Call 1) graph.

    Flow: greeting → confirm_interest → demographics → role_specific
          → salary_trajectory → score → qualify_or_close → goodbye
    """
    graph = StateGraph(ConversationState)

    # Add nodes
    graph.add_node("greeting", screening.greeting)
    graph.add_node("confirm_interest", screening.confirm_interest)
    graph.add_node("explain_process", screening.explain_process)
    graph.add_node("category_a", screening.category_a_demographics)
    graph.add_node("category_b", screening.category_b_role_specific)
    graph.add_node("category_c", screening.category_c_salary_trajectory)
    graph.add_node("score_and_qualify", screening.score_and_qualify)
    graph.add_node("communicate_result", screening.communicate_result)
    graph.add_node("goodbye", screening.goodbye)

    # Set entry point
    graph.set_entry_point("greeting")

    # Add edges
    graph.add_edge("greeting", "confirm_interest")
    graph.add_conditional_edges(
        "confirm_interest",
        screening.route_after_interest_check,
        {"interested": "explain_process", "not_interested": "goodbye"},
    )
    graph.add_edge("explain_process", "category_a")
    graph.add_edge("category_a", "category_b")
    graph.add_edge("category_b", "category_c")
    graph.add_edge("category_c", "score_and_qualify")
    graph.add_edge("score_and_qualify", "communicate_result")
    graph.add_edge("communicate_result", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_scheduling_graph() -> StateGraph:
    """Build the interview scheduling call (Call 2) graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", scheduling.greeting)
    graph.add_node("read_calendar", scheduling.read_calendar_slots)
    graph.add_node("present_slots", scheduling.present_slots)
    graph.add_node("confirm_slot", scheduling.confirm_slot)
    graph.add_node("block_calendars", scheduling.block_calendars)
    graph.add_node("goodbye", scheduling.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "read_calendar")
    graph.add_edge("read_calendar", "present_slots")
    graph.add_conditional_edges(
        "present_slots",
        scheduling.route_after_slot_presentation,
        {"slot_selected": "confirm_slot", "no_slot_works": "goodbye"},
    )
    graph.add_edge("confirm_slot", "block_calendars")
    graph.add_edge("block_calendars", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_reminder_graph() -> StateGraph:
    """Build the pre-interview reminder call (Call 3) graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", reminder.greeting)
    graph.add_node("confirm_attendance", reminder.confirm_attendance)
    graph.add_node("logistics", reminder.share_logistics)
    graph.add_node("goodbye", reminder.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "confirm_attendance")
    graph.add_conditional_edges(
        "confirm_attendance",
        reminder.route_after_attendance_check,
        {"attending": "logistics", "dropping": "goodbye"},
    )
    graph.add_edge("logistics", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_result_graph() -> StateGraph:
    """Build the post-interview result call (Call 4) graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", result.greeting)
    graph.add_node("communicate_result", result.communicate_result)
    graph.add_node("goodbye", result.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "communicate_result")
    graph.add_edge("communicate_result", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_pre_joining_graph() -> StateGraph:
    """Build the pre-joining confirmation call (Call 5) graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", pre_joining.greeting)
    graph.add_node("confirm_joining", pre_joining.confirm_joining)
    graph.add_node("engagement_check", pre_joining.engagement_check)
    graph.add_node("day1_logistics", pre_joining.day1_logistics)
    graph.add_node("goodbye", pre_joining.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "confirm_joining")
    graph.add_conditional_edges(
        "confirm_joining",
        pre_joining.route_after_confirmation,
        {
            "confirmed_short": "day1_logistics",
            "confirmed_long": "engagement_check",
            "withdrawn": "goodbye",
        },
    )
    graph.add_edge("engagement_check", "goodbye")
    graph.add_edge("day1_logistics", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_exit_graph() -> StateGraph:
    """Build the exit interview call (Call 6) graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", exit_call.greeting)
    graph.add_node("reason_for_leaving", exit_call.reason_for_leaving)
    graph.add_node("manager_experience", exit_call.manager_experience)
    graph.add_node("team_experience", exit_call.team_experience)
    graph.add_node("culture_rating", exit_call.culture_rating)
    graph.add_node("suggestions", exit_call.suggestions)
    graph.add_node("goodbye", exit_call.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "reason_for_leaving")
    graph.add_edge("reason_for_leaving", "manager_experience")
    graph.add_edge("manager_experience", "team_experience")
    graph.add_edge("team_experience", "culture_rating")
    graph.add_edge("culture_rating", "suggestions")
    graph.add_edge("suggestions", "goodbye")
    graph.add_edge("goodbye", END)

    return graph.compile()


def build_helpdesk_graph() -> StateGraph:
    """Build the HR helpdesk call graph."""
    graph = StateGraph(ConversationState)

    graph.add_node("greeting", helpdesk.greeting)
    graph.add_node("identify_query", helpdesk.identify_query)
    graph.add_node("resolve_or_escalate", helpdesk.resolve_or_escalate)
    graph.add_node("anything_else", helpdesk.anything_else)
    graph.add_node("goodbye", helpdesk.goodbye)

    graph.set_entry_point("greeting")
    graph.add_edge("greeting", "identify_query")
    graph.add_edge("identify_query", "resolve_or_escalate")
    graph.add_edge("resolve_or_escalate", "anything_else")
    graph.add_conditional_edges(
        "anything_else",
        helpdesk.route_after_anything_else,
        {"more_queries": "identify_query", "done": "goodbye"},
    )
    graph.add_edge("goodbye", END)

    return graph.compile()


# Pre-built graphs (instantiated once, reused per call)
GRAPHS = {
    "screening": build_screening_graph,
    "scheduling": build_scheduling_graph,
    "reminder_candidate": build_reminder_graph,
    "result": build_result_graph,
    "pre_joining": build_pre_joining_graph,
    "exit": build_exit_graph,
    "helpdesk": build_helpdesk_graph,
}


def get_graph(call_type: str):
    """Get the compiled graph for a given call type."""
    builder = GRAPHS.get(call_type)
    if not builder:
        raise ValueError(f"Unknown call type: {call_type}")
    return builder()
