# Neha - AI HR Agent | Architecture & Implementation Plan

> Voice & Call-Based Automation - Automating every candidate & employee touchpoint across the full hiring lifecycle.

---

## 1. System Overview

Neha is an AI-powered HR agent that automates 6 key touchpoints in the hiring lifecycle via voice calls, plus post-hire employee support. The system consists of:

- **Voice Call Engine** - Twilio handles telephony; Deepgram transcribes speech; ElevenLabs synthesizes responses; Claude (via LangGraph) drives conversation logic.
- **HR Dashboard** - Next.js frontend for HR teams to manage candidates, view call transcripts, scorecards, and analytics.
- **Backend API** - FastAPI orchestrates all workflows, webhooks, integrations, and the LangGraph agent.
- **Data Layer** - Supabase (PostgreSQL) for persistent storage; Upstash (Redis) for real-time call state and caching.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEHA - AI HR AGENT                          │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────────┐  │
│  │ Next.js  │───▶│  FastAPI      │───▶│  Supabase (PostgreSQL)   │  │
│  │ Dashboard│◀───│  Backend      │◀───│  + pgvector              │  │
│  └──────────┘    └──────┬───────┘    └───────────────────────────┘  │
│                         │                                           │
│              ┌──────────┼──────────┐                                │
│              │          │          │                                 │
│         ┌────▼───┐ ┌───▼────┐ ┌───▼────┐                           │
│         │ Twilio │ │Deepgram│ │Eleven  │                            │
│         │ Voice  │ │  STT   │ │Labs TTS│                            │
│         └────┬───┘ └───┬────┘ └───┬────┘                           │
│              │         │          │                                  │
│              └─────────┼──────────┘                                  │
│                        │                                             │
│              ┌─────────▼─────────┐                                  │
│              │   LangGraph +     │                                   │
│              │   Claude LLM      │                                   │
│              │   (Conversation   │                                   │
│              │    Orchestrator)  │                                   │
│              └───────────────────┘                                   │
│                                                                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  SendGrid  │  │Google Cal   │  │ Upstash  │  │  Webhooks     │  │
│  │  (Email)   │  │  API        │  │ (Redis)  │  │  (ATS/HRIS)   │  │
│  └────────────┘  └─────────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack (Confirmed)

| Layer              | Technology          | Why                                                      |
|--------------------|---------------------|----------------------------------------------------------|
| Backend API        | FastAPI + Python 3.11 | Async-native, perfect for webhook-heavy voice apps      |
| Frontend/Dashboard | Next.js 16 + Tailwind | Already initialized, deploy on Vercel                  |
| Database           | Supabase (PostgreSQL) | Free tier, real-time subscriptions, pgvector for memory |
| Cache / State      | Upstash (Redis)     | Serverless Redis, stores live call conversation state    |
| Calling            | Twilio              | Voice + WhatsApp sandbox + SMS, single account           |
| STT                | Deepgram Nova-2     | $200 free credits, best accuracy for Indian English      |
| TTS                | ElevenLabs          | 10k chars/month free, most natural voice                 |
| LLM                | Claude (Anthropic)  | Powers Neha's conversation, scoring, memory              |
| Agent Orchestration| LangGraph           | State machine for multi-step call flows                  |
| Email              | SendGrid            | 100 emails/day free forever                              |
| Calendar           | Google Calendar API | Interview slot sync, free                                |

---

## 3. Repository Structure

```
nehahr/
├── app/                          # Next.js 16 frontend (already exists)
│   ├── layout.tsx
│   ├── page.tsx                  # Landing / redirect to dashboard
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard shell with sidebar
│   │   ├── page.tsx              # Overview / stats
│   │   ├── candidates/
│   │   │   ├── page.tsx          # Candidate list (filterable, searchable)
│   │   │   └── [id]/page.tsx     # Candidate detail + call history + scorecard
│   │   ├── calls/
│   │   │   ├── page.tsx          # Call logs
│   │   │   └── [id]/page.tsx     # Call detail + transcript + recording
│   │   ├── interviews/
│   │   │   ├── page.tsx          # Interview schedule calendar view
│   │   │   └── [id]/page.tsx     # Interview detail
│   │   ├── jobs/
│   │   │   ├── page.tsx          # Job listings
│   │   │   └── [id]/page.tsx     # Job detail + candidates pipeline
│   │   ├── helpdesk/
│   │   │   └── page.tsx          # Employee query tickets
│   │   ├── analytics/
│   │   │   └── page.tsx          # Hiring funnel, exit patterns, pulse data
│   │   └── settings/
│   │       └── page.tsx          # API keys, company config, call scripts
│   └── api/                      # Next.js API routes (BFF / proxy to FastAPI)
│       └── ...
│
├── backend/                      # FastAPI backend (Python)
│   ├── pyproject.toml            # Dependencies (uv/pip)
│   ├── alembic.ini               # DB migrations config
│   ├── alembic/
│   │   └── versions/             # Migration files
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── config.py             # Settings via pydantic-settings
│   │   ├── dependencies.py       # Shared deps (db session, redis, auth)
│   │   │
│   │   ├── models/               # SQLAlchemy / Supabase models
│   │   │   ├── __init__.py
│   │   │   ├── candidate.py
│   │   │   ├── job.py
│   │   │   ├── call.py
│   │   │   ├── interview.py
│   │   │   ├── feedback.py
│   │   │   ├── employee.py
│   │   │   └── helpdesk_ticket.py
│   │   │
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── candidate.py
│   │   │   ├── call.py
│   │   │   ├── interview.py
│   │   │   └── ...
│   │   │
│   │   ├── routers/              # API route modules
│   │   │   ├── __init__.py
│   │   │   ├── candidates.py
│   │   │   ├── calls.py
│   │   │   ├── interviews.py
│   │   │   ├── jobs.py
│   │   │   ├── webhooks.py       # Twilio, Deepgram, calendar webhooks
│   │   │   ├── helpdesk.py
│   │   │   └── analytics.py
│   │   │
│   │   ├── services/             # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── call_service.py       # Initiate/manage calls via Twilio
│   │   │   ├── transcription.py      # Deepgram STT integration
│   │   │   ├── tts_service.py        # ElevenLabs TTS integration
│   │   │   ├── calendar_service.py   # Google Calendar integration
│   │   │   ├── email_service.py      # SendGrid emails
│   │   │   ├── scoring_service.py    # Candidate scoring logic
│   │   │   └── scheduling_service.py # Interview slot management
│   │   │
│   │   ├── agent/                # LangGraph agent definitions
│   │   │   ├── __init__.py
│   │   │   ├── graph.py          # Main LangGraph state machine
│   │   │   ├── state.py          # Conversation state definitions
│   │   │   ├── nodes/            # Graph nodes (one per conversation phase)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── screening.py      # Call 1 - Screening logic
│   │   │   │   ├── scheduling.py     # Call 2 - Interview scheduling
│   │   │   │   ├── reminder.py       # Call 3 - Pre-interview reminder
│   │   │   │   ├── result.py         # Call 4 - Post-interview result
│   │   │   │   ├── pre_joining.py    # Call 5 - Pre-joining confirmation
│   │   │   │   ├── exit_call.py      # Call 6 - Exit interview
│   │   │   │   └── helpdesk.py       # HR helpdesk conversations
│   │   │   ├── tools/            # LangGraph tools (actions the agent can take)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── calendar_tools.py
│   │   │   │   ├── email_tools.py
│   │   │   │   ├── db_tools.py
│   │   │   │   └── scoring_tools.py
│   │   │   └── prompts/          # System prompts per call type
│   │   │       ├── screening.md
│   │   │       ├── scheduling.md
│   │   │       ├── reminder.md
│   │   │       ├── result.md
│   │   │       ├── pre_joining.md
│   │   │       ├── exit_call.md
│   │   │       └── helpdesk.md
│   │   │
│   │   └── workers/              # Background tasks
│   │       ├── __init__.py
│   │       ├── call_scheduler.py     # Cron: trigger scheduled calls
│   │       ├── feedback_reminder.py  # Cron: remind interviewers for feedback
│   │       └── engagement_cadence.py # Cron: long-notice candidate check-ins
│   │
│   └── tests/
│       ├── test_screening.py
│       ├── test_scheduling.py
│       └── ...
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   ├── API_SPEC.md               # API endpoint documentation
│   ├── CALL_FLOWS.md             # Detailed call flow diagrams
│   └── DEPLOYMENT.md             # Deployment guide
│
├── supabase/                     # Supabase config & migrations
│   ├── config.toml
│   └── migrations/
│       └── ...
│
├── public/                       # Next.js public assets
├── package.json                  # Next.js dependencies
├── tsconfig.json
├── CLAUDE.md
├── AGENTS.md
└── .env.example                  # All required env vars
```

---

## 4. Database Schema (Supabase / PostgreSQL)

### Core Tables

```sql
-- Companies / Tenants
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    settings JSONB DEFAULT '{}',  -- call scripts, scoring criteria, etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs / Open Positions
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    work_model TEXT CHECK (work_model IN ('office', 'hybrid', 'remote')),
    job_description TEXT,
    required_skills TEXT[],
    role_type TEXT CHECK (role_type IN ('client_facing', 'team_handling', 'technical', 'other')),
    salary_range_min NUMERIC,
    salary_range_max NUMERIC,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Candidates
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    job_id UUID REFERENCES jobs(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    resume_url TEXT,

    -- Category A: Demographics (populated by screening call)
    current_location TEXT,
    open_to_relocation BOOLEAN,
    relocation_preferences TEXT[],
    work_model_preference TEXT,
    shift_flexibility BOOLEAN,
    employment_status TEXT,  -- 'employed', 'notice_period', 'between_jobs'
    last_working_day DATE,
    reason_for_leaving TEXT,
    current_ctc JSONB,       -- { fixed: X, variable: Y, esops: Z, bonus: W }
    expected_ctc JSONB,      -- { min: X, max: Y, non_negotiables: [] }
    notice_period_days INTEGER,
    early_release_possible BOOLEAN,

    -- Category B: Role-specific (populated by screening call)
    role_specific_answers JSONB,  -- varies by role_type

    -- Category C: Salary trajectory (populated by screening call)
    previous_ctc NUMERIC,
    ctc_growth_percentage NUMERIC,
    yoy_increments JSONB,
    financial_expectations JSONB,  -- buyout, joining bonus, etc.

    -- Scoring
    qualification_status TEXT DEFAULT 'pending'
        CHECK (qualification_status IN ('pending', 'qualified', 'unqualified')),
    score NUMERIC,
    score_breakdown JSONB,
    disqualification_reason TEXT,

    -- Pipeline stage
    stage TEXT DEFAULT 'new'
        CHECK (stage IN (
            'new', 'screening', 'screened', 'shortlisted',
            'scheduling', 'scheduled', 'interviewing',
            'offer', 'pre_joining', 'joined', 'rejected',
            'withdrawn', 'no_show'
        )),

    -- Engagement tracking
    engagement_score NUMERIC,  -- for long-notice candidates
    last_contact_at TIMESTAMPTZ,
    next_scheduled_contact TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calls
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    company_id UUID REFERENCES companies(id),

    call_type TEXT NOT NULL CHECK (call_type IN (
        'screening', 'scheduling', 'reminder_candidate',
        'reminder_interviewer', 'result', 'pre_joining',
        'engagement', 'exit', 'helpdesk', 'pulse_check'
    )),

    -- Twilio data
    twilio_call_sid TEXT UNIQUE,
    direction TEXT DEFAULT 'outbound',
    from_number TEXT,
    to_number TEXT,
    status TEXT DEFAULT 'queued'
        CHECK (status IN ('queued', 'ringing', 'in_progress',
                          'completed', 'failed', 'no_answer', 'busy')),
    duration_seconds INTEGER,
    recording_url TEXT,

    -- Transcript & AI
    transcript TEXT,
    transcript_segments JSONB,  -- [{speaker, text, timestamp}]
    ai_summary TEXT,
    extracted_data JSONB,       -- structured data extracted by Claude
    sentiment_score NUMERIC,

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Interviews
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    job_id UUID REFERENCES jobs(id),
    company_id UUID REFERENCES companies(id),

    round_number INTEGER NOT NULL,
    interviewer_name TEXT,
    interviewer_email TEXT,
    interview_type TEXT CHECK (interview_type IN ('in_person', 'video', 'phone')),

    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    location TEXT,

    -- Calendar
    google_event_id TEXT,

    -- Status
    status TEXT DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'in_progress',
                          'completed', 'cancelled', 'no_show')),

    -- Feedback
    feedback_status TEXT DEFAULT 'pending'
        CHECK (feedback_status IN ('pending', 'requested', 'submitted', 'overdue')),
    feedback_form_url TEXT,
    feedback JSONB,
    feedback_submitted_at TIMESTAMPTZ,

    -- Result
    result TEXT CHECK (result IN ('pass', 'fail', 'hold', 'pending')),
    result_communicated BOOLEAN DEFAULT false,
    result_communicated_at TIMESTAMPTZ,

    -- Reminder tracking
    candidate_reminded BOOLEAN DEFAULT false,
    interviewer_reminded BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Helpdesk Tickets
CREATE TABLE helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    employee_name TEXT NOT NULL,
    employee_phone TEXT NOT NULL,
    employee_email TEXT,

    bucket TEXT NOT NULL CHECK (bucket IN (
        'team_manager', 'time_attendance',
        'payroll', 'hr_documentation', 'it_helpdesk'
    )),

    query_text TEXT,
    call_id UUID REFERENCES calls(id),
    status TEXT DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'escalated')),
    escalated_to TEXT,
    resolution TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Exit Interviews
CREATE TABLE exit_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    employee_name TEXT,
    employee_email TEXT,
    call_id UUID REFERENCES calls(id),

    reason_for_leaving TEXT,
    manager_rating INTEGER,
    team_rating INTEGER,
    culture_rating INTEGER,
    suggestions TEXT,
    tags TEXT[],           -- auto-tagged themes
    summary TEXT,          -- AI-generated summary

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_candidates_stage ON candidates(stage);
CREATE INDEX idx_candidates_company ON candidates(company_id);
CREATE INDEX idx_calls_candidate ON calls(candidate_id);
CREATE INDEX idx_calls_type ON calls(call_type);
CREATE INDEX idx_interviews_scheduled ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);
```

---

## 5. LangGraph Agent Architecture

The core of Neha is a **LangGraph state machine** where each call type is a separate graph with nodes representing conversation phases.

### 5.1 Conversation State (Shared Across All Call Types)

```python
from typing import TypedDict, Literal, Optional
from langgraph.graph import StateGraph

class ConversationState(TypedDict):
    # Call metadata
    call_id: str
    call_type: str
    candidate_id: str
    company_id: str

    # Conversation
    messages: list           # [{role, content}] - full conversation history
    current_phase: str       # which part of the call we're in
    collected_data: dict     # structured data extracted so far
    pending_questions: list  # questions still to ask

    # Control
    should_end_call: bool
    transfer_to_human: bool
    next_action: str         # what to do after call ends
```

### 5.2 Screening Call Graph (Call 1 - Most Complex)

```
┌─────────────┐
│   START      │
│  Greeting &  │
│  Introduction│
└──────┬───────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐
│  Confirm     │───▶│  Not         │
│  Interest    │ no │  Interested  │──▶ END (log reason)
└──────┬───────┘    └──────────────┘
       │ yes
       ▼
┌─────────────┐
│  Category A  │
│  Demographics│
│  Questions   │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Category B  │
│  Role-Specific│
│  Questions   │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Category C  │
│  Salary      │
│  Trajectory  │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Score &     │
│  Qualify     │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌──────┐  ┌──────────┐
│QUAL  │  │UNQUAL    │
│Explain│  │Polite    │
│next   │  │close +   │
│steps  │  │reason    │
└──┬───┘  └────┬─────┘
   │           │
   ▼           ▼
  END         END
  (flag HR)   (close + email)
```

### 5.3 Graph Node Pattern (Each Node)

```python
async def category_a_node(state: ConversationState) -> ConversationState:
    """
    Each node:
    1. Reads current state (what's been collected so far)
    2. Determines which questions remain for this category
    3. Sends prompt to Claude with conversation history + remaining questions
    4. Claude generates the next conversational question
    5. Waits for candidate response (via Deepgram STT)
    6. Claude extracts structured data from response
    7. Updates state with extracted data
    8. If more questions remain, loops; otherwise transitions to next node
    """
    ...
```

### 5.4 All Six Call Graphs

| Graph | Trigger | Key Nodes |
|-------|---------|-----------|
| `screening_graph` | CV shortlisted by HR | greeting → confirm_interest → demographics → role_specific → salary_trajectory → score → qualify_or_close |
| `scheduling_graph` | HR approves candidate | greeting → read_calendar_slots → present_options → confirm_slot → block_calendars → send_invite |
| `reminder_graph` | 2hrs before interview | greeting → confirm_attendance → logistics_info → goodbye (candidate) / send_summary_email (interviewer) |
| `result_graph` | After each interview round | greeting → communicate_result → next_steps_or_close |
| `pre_joining_graph` | After offer accepted | greeting → confirm_joining → check_concerns → logistics_brief (Track A) or engagement_checkin (Track B) |
| `exit_graph` | Employee resigns | greeting → reason_for_leaving → manager_rating → team_rating → culture_rating → suggestions → summarize |

---

## 6. Real-Time Voice Call Flow

This is how a live call works end-to-end:

```
Phone rings (Twilio outbound call)
       │
       ▼
Candidate picks up
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                  CALL LOOP                            │
│                                                       │
│  1. Neha speaks (TTS)                                │
│     └─ Claude generates text → ElevenLabs → audio    │
│     └─ Audio streamed to Twilio → candidate hears    │
│                                                       │
│  2. Candidate speaks                                  │
│     └─ Twilio streams audio → Deepgram (real-time)   │
│     └─ Deepgram returns transcript chunks             │
│                                                       │
│  3. Process response                                  │
│     └─ Transcript sent to LangGraph node              │
│     └─ Claude extracts data + generates next response │
│     └─ State updated in Upstash Redis                 │
│     └─ Loop back to step 1                            │
│                                                       │
│  4. Call ends                                         │
│     └─ Final state saved to Supabase                  │
│     └─ Transcript saved                               │
│     └─ Scoring computed                               │
│     └─ Next actions triggered (email, flag HR, etc.)  │
└──────────────────────────────────────────────────────┘
```

### 6.1 Twilio Media Streams + WebSocket

```python
# backend/app/routers/webhooks.py

@router.post("/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """Twilio calls this when a call connects. We return TwiML
    that tells Twilio to open a WebSocket media stream to our server."""
    response = VoiceResponse()
    response.say("", voice="alice")  # silence
    start = response.connect()
    start.stream(url=f"wss://{BACKEND_HOST}/ws/call-stream/{call_id}")
    return Response(content=str(response), media_type="application/xml")


@router.websocket("/ws/call-stream/{call_id}")
async def call_stream(websocket: WebSocket, call_id: str):
    """Handles the real-time audio stream for a live call."""
    await websocket.accept()

    # 1. Load call state from Redis
    state = await redis.get(f"call:{call_id}")

    # 2. Connect to Deepgram for real-time STT
    deepgram_ws = await connect_deepgram()

    # 3. Play initial greeting (ElevenLabs TTS → Twilio)
    greeting = await generate_greeting(state)
    audio = await elevenlabs_tts(greeting)
    await stream_audio_to_twilio(websocket, audio)

    # 4. Listen loop
    async for message in websocket.iter_json():
        if message["event"] == "media":
            # Forward audio to Deepgram
            audio_payload = base64.b64decode(message["media"]["payload"])
            await deepgram_ws.send(audio_payload)

        elif message["event"] == "transcript":  # from Deepgram callback
            transcript = message["text"]
            if transcript.strip():
                # Run through LangGraph
                new_state = await agent_graph.ainvoke({
                    **state,
                    "messages": state["messages"] + [
                        {"role": "user", "content": transcript}
                    ]
                })

                # Generate and play AI response
                ai_response = new_state["messages"][-1]["content"]
                audio = await elevenlabs_tts(ai_response)
                await stream_audio_to_twilio(websocket, audio)

                # Update state in Redis
                await redis.set(f"call:{call_id}", json.dumps(new_state))
                state = new_state

                if new_state["should_end_call"]:
                    await end_call(call_id, new_state)
                    break
```

---

## 7. Integration Details

### 7.1 Twilio Setup

```python
# backend/app/services/call_service.py

from twilio.rest import Client

class CallService:
    def __init__(self):
        self.client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)

    async def initiate_call(
        self,
        to_number: str,
        call_type: str,
        candidate_id: str,
        metadata: dict = None
    ) -> str:
        """Initiate an outbound call via Twilio."""
        call = self.client.calls.create(
            to=to_number,
            from_=TWILIO_PHONE_NUMBER,
            url=f"{BACKEND_URL}/api/webhooks/twilio/voice"
                f"?call_type={call_type}"
                f"&candidate_id={candidate_id}",
            status_callback=f"{BACKEND_URL}/api/webhooks/twilio/status",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            record=True,
            recording_status_callback=f"{BACKEND_URL}/api/webhooks/twilio/recording",
        )
        return call.sid
```

### 7.2 Deepgram Real-Time STT

```python
# backend/app/services/transcription.py

from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions

class TranscriptionService:
    def __init__(self):
        self.dg = DeepgramClient(DEEPGRAM_API_KEY)

    async def create_live_connection(self, on_transcript_callback):
        """Create a real-time Deepgram connection for live STT."""
        connection = self.dg.listen.asynclive.v("1")

        options = LiveOptions(
            model="nova-2",
            language="en-IN",        # Indian English
            smart_format=True,
            interim_results=True,
            utterance_end_ms=1500,   # silence detection
            vad_events=True,
            endpointing=300,
        )

        connection.on(LiveTranscriptionEvents.Transcript, on_transcript_callback)
        await connection.start(options)
        return connection
```

### 7.3 ElevenLabs TTS

```python
# backend/app/services/tts_service.py

from elevenlabs import ElevenLabs

class TTSService:
    def __init__(self):
        self.client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        self.voice_id = "neha_voice_id"  # Clone or select a warm, professional voice

    async def synthesize(self, text: str) -> bytes:
        """Convert text to speech audio bytes (mulaw 8kHz for Twilio)."""
        audio = self.client.text_to_speech.convert(
            voice_id=self.voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="ulaw_8000",  # Twilio requires mulaw 8kHz
        )
        return audio
```

### 7.4 Google Calendar Integration

```python
# backend/app/services/calendar_service.py

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

class CalendarService:
    def __init__(self, credentials: dict):
        creds = Credentials.from_authorized_user_info(credentials)
        self.service = build("calendar", "v3", credentials=creds)

    async def get_available_slots(
        self, interviewer_email: str, date_range: tuple, duration_minutes: int = 60
    ) -> list[dict]:
        """Read interviewer's Google Calendar and find free slots."""
        freebusy = self.service.freebusy().query(body={
            "timeMin": date_range[0].isoformat(),
            "timeMax": date_range[1].isoformat(),
            "items": [{"id": interviewer_email}],
        }).execute()

        busy_times = freebusy["calendars"][interviewer_email]["busy"]
        # Calculate free slots from busy times
        return self._compute_free_slots(busy_times, date_range, duration_minutes)

    async def block_slot(
        self, interviewer_email: str, candidate_name: str,
        start_time: str, duration_minutes: int, meeting_link: bool = True
    ) -> dict:
        """Create a calendar event and optionally generate a Google Meet link."""
        event = {
            "summary": f"Interview - {candidate_name}",
            "start": {"dateTime": start_time, "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_time, "timeZone": "Asia/Kolkata"},
            "attendees": [{"email": interviewer_email}],
            "conferenceData": {
                "createRequest": {"requestId": str(uuid4())}
            } if meeting_link else {},
        }
        created = self.service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1,
        ).execute()
        return created
```

### 7.5 SendGrid Email

```python
# backend/app/services/email_service.py

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

class EmailService:
    def __init__(self):
        self.sg = SendGridAPIClient(SENDGRID_API_KEY)

    async def send_candidate_summary(
        self, interviewer_email: str, candidate_data: dict, hr_contact: str
    ):
        """Send pre-interview candidate summary to interviewer."""
        ...

    async def send_feedback_form(self, interviewer_email: str, interview_id: str):
        """Send feedback form link to interviewer post-interview."""
        ...

    async def send_rejection_email(self, candidate_email: str, reason: str):
        """Send polite rejection email to unqualified candidate."""
        ...

    async def send_calendar_invite(self, candidate_email: str, interview_details: dict):
        """Send interview confirmation with all details."""
        ...
```

---

## 8. Claude Prompt Architecture

Each call type has a dedicated system prompt. Here's the screening call prompt structure:

```markdown
# backend/app/agent/prompts/screening.md

You are Neha, an AI HR agent for {{company_name}}.
You are calling {{candidate_name}} about the {{job_title}} position.
The hiring recruiter for this role is {{recruiter_name}}.

## Your personality
- Professional, warm, conversational — not robotic
- Speak naturally, use filler words occasionally
- If the candidate seems confused, rephrase patiently
- Never pressure, always respectful of their time

## Call structure
1. Introduce yourself, the company, and the role
2. Confirm they're still interested and available to talk
3. Walk through demographic questions (Category A)
4. Walk through role-specific questions (Category B - {{role_type}})
5. Walk through salary trajectory (Category C)
6. Explain next steps

## Scoring criteria
{{scoring_criteria from company settings}}

## Rules
- Ask ONE question at a time, wait for response
- If candidate gives a partial answer, probe gently
- Extract structured data from conversational responses
- If candidate declines to answer, note it and move on
- NEVER book interviews — only flag qualified candidates for HR review
- If candidate is clearly unqualified, close politely with a reason

## Output format
After each candidate response, output:
1. Your next spoken response to the candidate
2. A JSON block with any structured data extracted:
   {"field": "current_location", "value": "Mumbai, Maharashtra"}
```

---

## 9. API Endpoints (FastAPI)

### 9.1 Candidates

```
GET    /api/candidates                    # List candidates (paginated, filterable)
GET    /api/candidates/{id}               # Candidate detail + scorecard
POST   /api/candidates                    # Create candidate (from ATS webhook or manual)
PATCH  /api/candidates/{id}               # Update candidate stage/data
POST   /api/candidates/{id}/calls         # Trigger a call to this candidate
GET    /api/candidates/{id}/calls         # Get all calls for candidate
GET    /api/candidates/{id}/timeline      # Full activity timeline
```

### 9.2 Calls

```
GET    /api/calls                         # List calls (paginated, filterable)
GET    /api/calls/{id}                    # Call detail + transcript + recording
POST   /api/calls/initiate               # Initiate a new outbound call
POST   /api/calls/{id}/end               # Manually end a call
```

### 9.3 Interviews

```
GET    /api/interviews                    # List scheduled interviews
GET    /api/interviews/{id}              # Interview detail
POST   /api/interviews                   # Schedule interview (triggers AI scheduling call)
PATCH  /api/interviews/{id}              # Update interview status
POST   /api/interviews/{id}/feedback     # Submit interviewer feedback
```

### 9.4 Jobs

```
GET    /api/jobs                          # List jobs
POST   /api/jobs                         # Create job posting
GET    /api/jobs/{id}                    # Job detail
GET    /api/jobs/{id}/pipeline           # Candidates pipeline for this job
PATCH  /api/jobs/{id}                    # Update job
```

### 9.5 Webhooks (Inbound)

```
POST   /api/webhooks/twilio/voice        # Twilio call connected → return TwiML
POST   /api/webhooks/twilio/status       # Twilio call status updates
POST   /api/webhooks/twilio/recording    # Twilio recording ready
WS     /ws/call-stream/{call_id}         # WebSocket for real-time audio stream
POST   /api/webhooks/calendar/events     # Google Calendar push notifications
```

### 9.6 Helpdesk

```
GET    /api/helpdesk/tickets             # List tickets
GET    /api/helpdesk/tickets/{id}        # Ticket detail
POST   /api/helpdesk/call                # Initiate helpdesk call
```

### 9.7 Analytics

```
GET    /api/analytics/funnel             # Hiring funnel metrics
GET    /api/analytics/calls              # Call volume & outcomes
GET    /api/analytics/exit-patterns      # Exit interview theme analysis
GET    /api/analytics/engagement         # Employee pulse check data
```

---

## 10. Frontend Pages (Next.js Dashboard)

### 10.1 Key Pages

| Page | Purpose |
|------|---------|
| `/` | Landing page or redirect to `/dashboard` |
| `/login` | Supabase Auth login |
| `/dashboard` | Overview: today's calls, pending actions, key metrics |
| `/candidates` | Searchable candidate list with stage filters |
| `/candidates/[id]` | Candidate profile: scorecard, call history, timeline, transcripts |
| `/jobs` | Job listings with candidate pipeline counts |
| `/jobs/[id]` | Kanban-style pipeline board for a job |
| `/interviews` | Calendar view of scheduled interviews |
| `/calls` | Call log with filters (type, status, date) |
| `/calls/[id]` | Call detail: audio player, live transcript, extracted data |
| `/helpdesk` | Employee query tickets with bucket filters |
| `/analytics` | Charts: funnel, call metrics, exit patterns, sentiment |
| `/settings` | Company config, API keys, call scripts, scoring criteria |

### 10.2 Real-Time Features (Supabase Realtime)

- **Live call indicator** - When a call is in progress, dashboard shows live status
- **Candidate stage updates** - Pipeline boards update in real-time
- **New ticket notifications** - Helpdesk tickets appear instantly
- **Feedback submission alerts** - HR notified when interviewer submits feedback

---

## 11. Background Workers / Scheduled Tasks

| Worker | Schedule | What It Does |
|--------|----------|--------------|
| `call_scheduler` | Every 5 min | Checks for pending calls (screening queue, scheduled reminders) and initiates them |
| `reminder_trigger` | Every 15 min | Finds interviews happening in ~2 hours, triggers reminder calls to candidate + summary email to interviewer |
| `feedback_reminder` | Every 30 min | Finds interviews completed >2hrs ago without feedback, sends reminder email |
| `engagement_cadence` | Daily at 10am | Finds long-notice candidates due for check-in call, queues them |
| `dropout_detector` | Daily at 9am | Finds candidates with offer letters who haven't responded in 48hrs, triggers check-in call |
| `exit_pattern_analyzer` | Weekly | Runs Claude analysis over recent exit interviews, surfaces patterns |

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal: Backend skeleton + Database + Basic dashboard**

- [ ] Set up FastAPI project structure with `uv`
- [ ] Configure Supabase project and run initial migrations (all tables above)
- [ ] Set up Upstash Redis instance
- [ ] Implement basic FastAPI CRUD routes for candidates, jobs, calls, interviews
- [ ] Set up Supabase Auth for the Next.js frontend
- [ ] Build dashboard layout (sidebar, navigation)
- [ ] Build candidates list page and candidate detail page
- [ ] Build jobs list page
- [ ] Set up `.env` with all API keys
- [ ] Set up Alembic for database migrations

### Phase 2: Voice Engine (Week 3-4)
**Goal: Make Neha talk - Twilio + Deepgram + ElevenLabs working end-to-end**

- [ ] Set up Twilio account, buy phone number, configure webhooks
- [ ] Implement Twilio outbound call initiation (`call_service.py`)
- [ ] Implement Twilio voice webhook → TwiML with media stream
- [ ] Implement WebSocket handler for Twilio media streams
- [ ] Integrate Deepgram real-time STT (Nova-2, Indian English)
- [ ] Integrate ElevenLabs TTS (mulaw 8kHz output for Twilio)
- [ ] Test: Make a call, speak, hear Neha respond with a hardcoded message
- [ ] Implement call recording storage
- [ ] Implement call status tracking via Twilio status callbacks

### Phase 3: LangGraph Agent - Screening Call (Week 5-6)
**Goal: Full screening call (Call 1) working end-to-end with Claude**

- [ ] Set up LangGraph with `langgraph` package
- [ ] Define `ConversationState` TypedDict
- [ ] Build screening graph nodes: greeting → confirm_interest → cat_a → cat_b → cat_c → score → qualify
- [ ] Write screening system prompt with all 3 question categories
- [ ] Implement Claude integration (Anthropic SDK) within LangGraph nodes
- [ ] Implement structured data extraction (JSON from conversation)
- [ ] Implement candidate scoring logic
- [ ] Implement qualification/disqualification flow
- [ ] Wire LangGraph into the WebSocket call handler
- [ ] Store conversation state in Upstash Redis during call
- [ ] Save final call data (transcript, score, extracted data) to Supabase
- [ ] Build call transcript viewer in dashboard
- [ ] Build candidate scorecard component

### Phase 4: Scheduling + Calendar (Week 7-8)
**Goal: Interview scheduling call (Call 2) + Google Calendar integration**

- [ ] Set up Google Calendar API OAuth flow
- [ ] Implement `CalendarService` - read availability, block slots, create events
- [ ] Build scheduling LangGraph graph
- [ ] Implement slot presentation logic (voice: "I have Tuesday at 2pm or Wednesday at 10am...")
- [ ] Implement slot confirmation (voice response or DTMF keypad)
- [ ] Auto-block confirmed slots in interviewer + HR calendars
- [ ] Auto-generate Google Meet links for virtual interviews
- [ ] Send calendar invite email via SendGrid
- [ ] Build interview schedule page in dashboard (calendar view)
- [ ] Handle rescheduling and cancellation flows

### Phase 5: Reminders + Results (Week 9-10)
**Goal: Calls 3 and 4 - Pre-interview reminder + Post-interview result**

- [ ] Build reminder LangGraph graph (candidate version)
- [ ] Implement reminder trigger worker (2hrs before interview)
- [ ] Build interviewer email with candidate summary
- [ ] Handle candidate dropout → free slot + notify HR
- [ ] Build result communication LangGraph graph
- [ ] Integrate with feedback system
- [ ] Implement feedback form dispatch (email with link)
- [ ] Implement feedback reminder (if not submitted in 2hrs)
- [ ] Auto-link feedback to candidate profile
- [ ] Build feedback form page
- [ ] Update pipeline stage automatically based on results

### Phase 6: Pre-Joining + Exit (Week 11-12)
**Goal: Calls 5 and 6 - Pre-joining confirmation + Exit interview**

- [ ] Build pre-joining LangGraph graph (Track A: short notice)
- [ ] Build pre-joining LangGraph graph (Track B: long notice, engagement cadence)
- [ ] Implement dropout detection worker
- [ ] Implement engagement scoring from conversational cues
- [ ] Build exit interview LangGraph graph
- [ ] Implement auto-transcription and summarization
- [ ] Implement exit pattern analysis (tags, themes by team/manager/tenure)
- [ ] Build exit analytics view in dashboard

### Phase 7: HR Helpdesk (Week 13-14)
**Goal: Employee support via voice - 5 buckets**

- [ ] Build helpdesk LangGraph graph with bucket classification
- [ ] Implement query routing logic (identify bucket from conversation)
- [ ] Implement resolution for factual queries (pull from knowledge base)
- [ ] Implement escalation flow (with full context attached)
- [ ] Build helpdesk ticket management page in dashboard
- [ ] Set up inbound call handling (employees calling Neha)

### Phase 8: Analytics + Polish (Week 15-16)
**Goal: Analytics dashboard, edge cases, production hardening**

- [ ] Build hiring funnel analytics
- [ ] Build call metrics dashboard (volume, duration, success rates)
- [ ] Build exit pattern visualization
- [ ] Build employee sentiment tracking (pulse checks)
- [ ] Implement retry logic for failed calls
- [ ] Implement rate limiting
- [ ] Add error handling and fallback responses
- [ ] Implement call quality monitoring
- [ ] Security audit (API auth, data encryption, PII handling)
- [ ] Load testing with concurrent calls
- [ ] Deploy: FastAPI on Railway/Fly.io, Next.js on Vercel

---

## 13. Environment Variables

```bash
# .env.example

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://...

# Upstash Redis
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

# Deepgram
DEEPGRAM_API_KEY=xxx

# ElevenLabs
ELEVENLABS_API_KEY=xxx
ELEVENLABS_VOICE_ID=xxx

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxx

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=neha@yourcompany.com

# Google Calendar
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# App
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

---

## 14. Key Design Decisions

### Why LangGraph (not plain Claude calls)?

1. **State machine control** - Each call type has a defined flow. LangGraph ensures the conversation follows the correct sequence (greeting → questions → scoring → close) without the LLM skipping steps.
2. **Checkpointing** - If a call drops mid-conversation, LangGraph state can be restored from Redis and the call can be resumed.
3. **Tool calling** - LangGraph nodes can call tools (calendar, email, database) as part of the conversation flow, not just generate text.
4. **Human-in-the-loop** - For steps that require HR approval (like shortlisting), LangGraph can pause the graph and wait for human input.

### Why WebSocket for calls (not REST polling)?

Real-time voice requires <200ms latency. WebSocket gives us bidirectional streaming between Twilio's media stream, Deepgram's live STT, and our agent.

### Why separate FastAPI backend (not Next.js API routes)?

1. Python ecosystem for AI/ML (LangGraph, Anthropic SDK, Deepgram SDK) is more mature
2. WebSocket handling is better in FastAPI/uvicorn than Next.js
3. Background workers (scheduling, reminders) run naturally in Python
4. Next.js frontend stays lean — just UI and BFF proxy

### Why Upstash Redis for call state (not just Supabase)?

Live call state changes every few seconds (new transcript chunks, extracted data). Redis gives sub-millisecond reads/writes. Final state is persisted to Supabase when the call ends.

---

## 15. Deployment Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Vercel         │         │  Railway / Fly.io │
│   (Next.js)      │────────▶│  (FastAPI)        │
│   Frontend       │◀────────│  Backend          │
│   Dashboard      │         │  + Workers        │
└─────────────────┘         └────────┬─────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                   │
              ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │ Supabase   │   │  Upstash    │   │  Twilio     │
              │ PostgreSQL │   │  Redis      │   │  Voice      │
              └────────────┘   └─────────────┘   └─────────────┘
```

- **Frontend**: Vercel (free tier, auto-deploy from git)
- **Backend**: Railway or Fly.io (supports WebSocket, background workers)
- **Database**: Supabase (managed PostgreSQL, free tier)
- **Cache**: Upstash (serverless Redis, free tier)
- **Domain**: Custom domain on Vercel + API subdomain on Railway

---

## 16. Security Considerations

- **PII handling**: Candidate phone numbers, salaries, and personal data must be encrypted at rest (Supabase handles this) and in transit (HTTPS/WSS everywhere)
- **Call recordings**: Stored in Twilio with access controls, not downloaded to our servers unless needed
- **API auth**: Supabase JWT tokens for frontend ↔ backend; API keys for service-to-service
- **Rate limiting**: Prevent abuse of call initiation endpoints
- **DTMF/voice consent**: Neha announces "this call may be recorded" at the start of every call
- **Data retention**: Configurable per company — auto-delete candidate data after X months
