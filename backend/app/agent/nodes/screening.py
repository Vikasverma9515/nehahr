"""Screening call (Call 1) graph nodes.

Each node handles one phase of the screening conversation.
Nodes interact with Claude to generate conversational responses
and extract structured data from candidate answers.
"""

from app.agent.state import ConversationState


async def greeting(state: ConversationState) -> ConversationState:
    """Introduce Neha, the company, and the role. Ask if it's a good time."""
    # TODO: Generate greeting using Claude with company/role context
    # TODO: Return updated state with greeting message
    return {
        **state,
        "current_phase": "greeting",
        "messages": state.get("messages", []) + [
            {
                "role": "assistant",
                "content": (
                    f"Hi, am I speaking with {state['candidate_name']}? "
                    f"This is Neha calling from {state['company_name']}. "
                    f"{state['recruiter_name']} from our hiring team asked me to "
                    f"reach out regarding the {state['job_title']} position. "
                    f"Is this a good time to talk?"
                ),
            }
        ],
    }


async def confirm_interest(state: ConversationState) -> ConversationState:
    """Confirm the candidate is still interested in the role."""
    # TODO: Process candidate's response to greeting
    # TODO: Determine if they're interested
    return {**state, "current_phase": "confirm_interest"}


def route_after_interest_check(state: ConversationState) -> str:
    """Route based on whether candidate is interested."""
    # TODO: Analyze conversation to determine interest
    # For now, default to interested
    return "interested"


async def explain_process(state: ConversationState) -> ConversationState:
    """Explain the screening call process and what to expect."""
    return {**state, "current_phase": "explain_process"}


async def category_a_demographics(state: ConversationState) -> ConversationState:
    """Ask Category A demographic questions.

    Collects: location, relocation, work model, shift flexibility,
    employment status, CTC, expected CTC, notice period.
    """
    # TODO: Iterate through Category A questions conversationally
    # TODO: Extract structured data from each response
    # TODO: Store in collected_data
    return {**state, "current_phase": "category_a"}


async def category_b_role_specific(state: ConversationState) -> ConversationState:
    """Ask Category B role-specific questions.

    Questions vary based on role_type:
    - client_facing: client engagement history
    - team_handling: team management experience
    - technical: tech stack proficiency
    """
    # TODO: Select questions based on role_type
    # TODO: Conversational Q&A with Claude
    return {**state, "current_phase": "category_b"}


async def category_c_salary_trajectory(state: ConversationState) -> ConversationState:
    """Ask Category C salary growth questions.

    Collects: previous CTC, growth %, YoY increments, financial expectations.
    """
    # TODO: Conversational salary questions
    return {**state, "current_phase": "category_c"}


async def score_and_qualify(state: ConversationState) -> ConversationState:
    """Score the candidate based on collected data and company criteria.

    Scoring weights:
    - Location/relocation fit: 10%
    - Work model match: 10%
    - Notice period fit: 15%
    - CTC alignment: 20%
    - Role-specific experience: 30%
    - Salary trajectory: 15%
    """
    # TODO: Run scoring logic using Claude + criteria
    # TODO: Determine qualified/unqualified
    return {
        **state,
        "current_phase": "score_and_qualify",
        "qualification_status": "pending",
    }


async def communicate_result(state: ConversationState) -> ConversationState:
    """Tell the candidate the outcome.

    Qualified: explain next steps, flag for HR review.
    Unqualified: polite close with reason, trigger rejection email.
    """
    # TODO: Generate appropriate response based on qualification_status
    return {**state, "current_phase": "communicate_result"}


async def goodbye(state: ConversationState) -> ConversationState:
    """Wrap up the call. Save all data."""
    return {
        **state,
        "current_phase": "goodbye",
        "should_end_call": True,
        "next_action": "save_screening_results",
    }
