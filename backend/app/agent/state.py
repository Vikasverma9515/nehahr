"""Conversation state definitions for all call types."""

from typing import TypedDict, Literal


CallType = Literal[
    "screening",
    "scheduling",
    "reminder_candidate",
    "reminder_interviewer",
    "result",
    "pre_joining",
    "engagement",
    "exit",
    "helpdesk",
    "pulse_check",
]

QualificationStatus = Literal["pending", "qualified", "unqualified"]


class ConversationState(TypedDict, total=False):
    # Call metadata
    call_id: str
    call_type: CallType
    candidate_id: str
    company_id: str
    job_id: str

    # Company context (loaded at call start)
    company_name: str
    recruiter_name: str
    job_title: str
    job_description: str
    role_type: str  # client_facing, team_handling, technical
    scoring_criteria: dict

    # Candidate context (loaded at call start for follow-up calls)
    candidate_name: str
    candidate_phone: str
    candidate_data: dict  # existing data from previous calls

    # Interview context (for scheduling/reminder/result calls)
    interview_id: str
    interviewer_name: str
    interviewer_email: str
    available_slots: list[dict]
    confirmed_slot: dict | None

    # Conversation
    messages: list[dict]       # [{role: "assistant"|"user", content: str}]
    current_phase: str         # which node we're in
    collected_data: dict       # structured data extracted so far
    pending_questions: list[str]  # questions still to ask

    # Scoring (screening call)
    qualification_status: QualificationStatus
    score: float
    score_breakdown: dict
    disqualification_reason: str

    # Engagement tracking (pre-joining calls)
    engagement_score: float
    engagement_signals: list[str]
    competing_offer_detected: bool

    # Exit interview data
    exit_data: dict

    # Helpdesk
    helpdesk_bucket: str
    ticket_id: str

    # Control flow
    should_end_call: bool
    transfer_to_human: bool
    next_action: str           # post-call action to trigger
    error: str | None
