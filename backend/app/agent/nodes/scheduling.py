"""Interview scheduling call (Call 2) graph nodes."""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Inform candidate they've been shortlisted for interview."""
    return {**state, "current_phase": "greeting"}


async def read_calendar_slots(state: ConversationState) -> ConversationState:
    """Fetch available slots from interviewer's Google Calendar."""
    # TODO: Call CalendarService.get_available_slots()
    # TODO: Cross-reference with HR calendar
    # TODO: Generate 3-5 slot options
    return {**state, "current_phase": "read_calendar", "available_slots": []}


async def present_slots(state: ConversationState) -> ConversationState:
    """Present available interview slots to the candidate."""
    # TODO: Generate conversational slot presentation
    return {**state, "current_phase": "present_slots"}


def route_after_slot_presentation(state: ConversationState) -> str:
    """Route based on whether candidate selected a slot."""
    if state.get("confirmed_slot"):
        return "slot_selected"
    return "no_slot_works"


async def confirm_slot(state: ConversationState) -> ConversationState:
    """Confirm the selected slot with the candidate."""
    return {**state, "current_phase": "confirm_slot"}


async def block_calendars(state: ConversationState) -> ConversationState:
    """Block the confirmed slot across all calendars and send invites.

    Actions:
    1. Block in interviewer's Google Calendar
    2. Block in HR calendar
    3. Generate Google Meet link (if video)
    4. Send calendar invite email to candidate
    5. Create interview record in database
    """
    # TODO: CalendarService.block_slot()
    # TODO: EmailService.send_calendar_invite()
    # TODO: Create interview record
    return {**state, "current_phase": "block_calendars"}


async def goodbye(state: ConversationState) -> ConversationState:
    """Wrap up scheduling call."""
    return {**state, "current_phase": "goodbye", "should_end_call": True}
