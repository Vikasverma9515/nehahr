# Neha AI HR Agent — Phase-wise Development Plan

> Each phase is broken into independent parts that can be worked on in parallel by different people or tackled sequentially. Every part has clear inputs, outputs, and a definition of done.

---

## Phase 1: Foundation (Week 1–2)

**Goal:** Backend running, database ready, basic dashboard shell visible.

---

### Part 1A: Backend Project Setup
**Owner:** Backend Dev  
**Depends on:** Nothing  

**Tasks:**
1. Install Python 3.11+ and `uv` package manager
2. Run `cd backend && uv sync` to install all dependencies from `pyproject.toml`
3. Verify FastAPI starts: `uvicorn app.main:app --reload --port 8000`
4. Hit `GET /health` → should return `{"status": "ok", "agent": "neha"}`
5. Add `.env` file from `.env.example` with placeholder values
6. Verify all 7 routers load without import errors

**Done when:** `http://localhost:8000/docs` shows all API routes in Swagger UI.

---

### Part 1B: Supabase Database Setup
**Owner:** Backend Dev  
**Depends on:** Nothing (can run in parallel with 1A)  

**Tasks:**
1. Create Supabase project at supabase.com
2. Copy project URL and keys into `.env`
3. Create all 7 tables from the schema in `ARCHITECTURE.md` section 4:
   - `companies`
   - `jobs`
   - `candidates`
   - `calls`
   - `interviews`
   - `helpdesk_tickets`
   - `exit_interviews`
4. Create all indexes listed in the schema
5. Enable Row Level Security (RLS) on all tables
6. Create RLS policies for service-key access
7. Test: insert a dummy company, job, and candidate via Supabase dashboard
8. Set up Alembic for future migrations:
   - `cd backend && alembic init alembic`
   - Configure `alembic.ini` with `DATABASE_URL`
   - Create initial migration from existing schema

**Done when:** All tables exist in Supabase, dummy data can be inserted and queried.

---

### Part 1C: SQLAlchemy Models
**Owner:** Backend Dev  
**Depends on:** 1B (schema must be finalized)  

**Tasks:**
1. Create `backend/app/models/base.py` — SQLAlchemy Base and async engine setup
2. Create `backend/app/models/company.py` — Company model
3. Create `backend/app/models/job.py` — Job model
4. Create `backend/app/models/candidate.py` — Candidate model with all fields (demographics, scoring, stage)
5. Create `backend/app/models/call.py` — Call model (twilio fields, transcript, AI data)
6. Create `backend/app/models/interview.py` — Interview model (scheduling, feedback, result)
7. Create `backend/app/models/helpdesk_ticket.py` — Helpdesk ticket model
8. Create `backend/app/models/exit_interview.py` — Exit interview model
9. Verify all models map correctly to Supabase tables

**Done when:** All models defined, relationships set up, no import errors.

---

### Part 1D: CRUD API Routes (Backend)
**Owner:** Backend Dev  
**Depends on:** 1A + 1C  

**Tasks:**
1. Create Pydantic schemas for each entity in `backend/app/schemas/`:
   - `candidate.py` — CandidateCreate, CandidateUpdate, CandidateResponse, CandidateList
   - `job.py` — JobCreate, JobUpdate, JobResponse
   - `call.py` — CallResponse, CallDetail (with transcript)
   - `interview.py` — InterviewCreate, InterviewResponse, FeedbackSubmit
   - `helpdesk.py` — TicketResponse
2. Implement `candidates.py` router:
   - `GET /` — list with pagination (`skip`, `limit`), filter by `stage`, `job_id`
   - `GET /{id}` — full candidate detail with score breakdown
   - `POST /` — create candidate (validate phone, email)
   - `PATCH /{id}` — update stage, data fields
   - `GET /{id}/calls` — all calls for this candidate
   - `GET /{id}/timeline` — activity log (calls + stage changes + interviews)
3. Implement `jobs.py` router:
   - `GET /` — list jobs with candidate counts per stage
   - `POST /` — create job
   - `GET /{id}` — job detail
   - `GET /{id}/pipeline` — candidates grouped by stage for this job
   - `PATCH /{id}` — update job status/details
4. Implement `calls.py` router:
   - `GET /` — list calls with filters (call_type, status, date range)
   - `GET /{id}` — call detail with transcript, recording URL, extracted data
5. Implement `interviews.py` router:
   - `GET /` — list interviews with date range filter
   - `GET /{id}` — interview detail
   - `PATCH /{id}` — update status, result
   - `POST /{id}/feedback` — submit interviewer feedback
6. Implement `helpdesk.py` router:
   - `GET /tickets` — list with bucket filter
   - `GET /tickets/{id}` — ticket detail with call transcript
7. Test all endpoints via Swagger UI or Postman

**Done when:** All CRUD operations work end-to-end with Supabase. Can create a candidate, view them, update their stage.

---

### Part 1E: Upstash Redis Setup
**Owner:** Backend Dev  
**Depends on:** Nothing  

**Tasks:**
1. Create Upstash Redis database at upstash.com
2. Copy URL and token to `.env`
3. Test connection from FastAPI using `dependencies.py` → `get_redis()`
4. Verify basic set/get operations work
5. Define key patterns for call state:
   - `call:{call_id}` → JSON conversation state
   - `call:{call_id}:transcript` → running transcript
   - TTL: 2 hours (auto-cleanup after call ends)

**Done when:** Redis connected, can store and retrieve call state JSON.

---

### Part 1F: Frontend Dashboard Shell
**Owner:** Frontend Dev  
**Depends on:** Nothing (can start day 1)  

**Tasks:**
1. Install additional Next.js dependencies:
   ```
   npm install @supabase/supabase-js @supabase/ssr lucide-react
   ```
2. Create Supabase client utility: `app/lib/supabase.ts`
3. Create dashboard layout with sidebar:
   - `app/(dashboard)/layout.tsx` — sidebar + top bar + main content area
   - Sidebar links: Dashboard, Candidates, Jobs, Interviews, Calls, Helpdesk, Analytics, Settings
4. Create placeholder pages (just titles, no data yet):
   - `app/(dashboard)/page.tsx` — "Dashboard" heading
   - `app/(dashboard)/candidates/page.tsx` — "Candidates" heading
   - `app/(dashboard)/jobs/page.tsx` — "Jobs" heading
   - `app/(dashboard)/interviews/page.tsx` — "Interviews" heading
   - `app/(dashboard)/calls/page.tsx` — "Calls" heading
   - `app/(dashboard)/helpdesk/page.tsx` — "Helpdesk" heading
   - `app/(dashboard)/analytics/page.tsx` — "Analytics" heading
   - `app/(dashboard)/settings/page.tsx` — "Settings" heading
5. Build reusable UI components:
   - `app/components/ui/sidebar.tsx`
   - `app/components/ui/page-header.tsx`
   - `app/components/ui/data-table.tsx` (basic table component)
   - `app/components/ui/badge.tsx` (for status badges)
   - `app/components/ui/card.tsx`
6. Set up API client utility: `app/lib/api.ts` — fetch wrapper pointing to FastAPI backend

**Done when:** Dashboard loads at `localhost:3000` with working sidebar navigation. All pages show their heading. No data needed yet.

---

### Part 1G: Authentication (Supabase Auth)
**Owner:** Frontend Dev  
**Depends on:** 1F  

**Tasks:**
1. Enable Email auth in Supabase dashboard → Authentication → Providers
2. Create auth pages:
   - `app/(auth)/login/page.tsx` — email + password login form
   - `app/(auth)/signup/page.tsx` — registration form (company name + email + password)
3. Create auth middleware: `middleware.ts` — redirect unauthenticated users to login
4. Create auth context/hook: `app/lib/auth.ts`
5. Add logout button to dashboard sidebar
6. On signup: create a `companies` row in Supabase linked to the auth user
7. Pass Supabase JWT token in API calls to FastAPI backend
8. Add JWT validation middleware in FastAPI (`dependencies.py`)

**Done when:** Can sign up, log in, see dashboard. Unauthenticated users redirected to login.

---

### Phase 1 Completion Checklist
- [ ] FastAPI running with all routes on Swagger
- [ ] All 7 database tables created in Supabase
- [ ] CRUD operations working for candidates, jobs, calls, interviews
- [ ] Redis connected and tested
- [ ] Next.js dashboard with sidebar and all placeholder pages
- [ ] Auth flow working (signup → login → dashboard)
- [ ] Frontend can call backend API and display data

---

## Phase 2: Voice Engine (Week 3–4)

**Goal:** Make an outbound call, hear Neha speak, speak back, see the transcript.

---

### Part 2A: Twilio Account & Phone Number
**Owner:** Backend Dev  
**Depends on:** 1A  

**Tasks:**
1. Create Twilio account (trial gives $15 credit)
2. Buy a phone number with Voice capability (~$1.15/month)
3. Copy Account SID, Auth Token, Phone Number to `.env`
4. Verify Twilio SDK works: make a test call to your personal phone using `call_service.py`
5. Set up a tunnel for local development:
   - Install: `npm install -g localtunnel` or use ngrok
   - Run: `npx localtunnel --port 8000 --subdomain neha-dev`
   - Update `BACKEND_URL` in `.env` with tunnel URL
6. Configure Twilio phone number webhooks in Twilio console:
   - Voice webhook: `{BACKEND_URL}/api/webhooks/twilio/voice`
   - Status callback: `{BACKEND_URL}/api/webhooks/twilio/status`

**Done when:** Can initiate an outbound call from code. Phone rings. Twilio status webhook fires.

---

### Part 2B: Twilio Voice Webhook (TwiML)
**Owner:** Backend Dev  
**Depends on:** 2A  

**Tasks:**
1. Install Twilio helper: already in `pyproject.toml`
2. Implement `POST /api/webhooks/twilio/voice`:
   - Parse query params: `call_type`, `candidate_id`
   - Create a `calls` record in Supabase with status `in_progress`
   - Initialize conversation state in Redis
   - Return TwiML response that opens a bidirectional media stream:
     ```python
     from twilio.twiml.voice_response import VoiceResponse, Connect
     response = VoiceResponse()
     connect = Connect()
     connect.stream(url=f"wss://{host}/api/webhooks/ws/call-stream/{call_id}")
     response.append(connect)
     ```
3. Implement `POST /api/webhooks/twilio/status`:
   - Parse Twilio status callback form data
   - Update call status in Supabase (ringing → in_progress → completed)
   - On `completed`: save duration, clean up Redis state
4. Implement `POST /api/webhooks/twilio/recording`:
   - Save `RecordingUrl` to the call record in Supabase
5. Test: initiate a call → phone rings → answer → Twilio opens media stream

**Done when:** Call connects, media stream WebSocket opens, status updates logged in DB.

---

### Part 2C: Deepgram Real-Time STT Integration
**Owner:** Backend Dev  
**Depends on:** 2B  

**Tasks:**
1. Create Deepgram account, get API key, add to `.env`
2. Flesh out `transcription.py` service:
   - `create_live_connection()` — opens Deepgram WebSocket with Nova-2, Indian English
   - Handle `LiveTranscriptionEvents.Transcript` — interim and final results
   - Handle `LiveTranscriptionEvents.UtteranceEnd` — silence detection (candidate stopped speaking)
3. Wire into WebSocket handler (`/ws/call-stream/{call_id}`):
   - Receive raw audio from Twilio media stream (base64 mulaw)
   - Decode and forward to Deepgram WebSocket
   - Collect transcript chunks
   - On utterance end: treat as complete candidate response
4. Store running transcript in Redis: `call:{call_id}:transcript`
5. Test: call → speak → see transcript appearing in logs/Redis

**Done when:** Can call, speak naturally, and see accurate real-time transcript in Redis.

---

### Part 2D: ElevenLabs TTS Integration
**Owner:** Backend Dev  
**Depends on:** 2B  

**Tasks:**
1. Create ElevenLabs account, get API key
2. Choose or clone a voice for Neha:
   - Option A: Use a pre-made voice (Rachel, Bella — warm, professional)
   - Option B: Clone a custom voice (upload 1-5 min sample of desired voice)
3. Copy voice ID to `.env`
4. Flesh out `tts_service.py`:
   - `synthesize(text)` — full text to audio bytes (mulaw 8kHz)
   - `stream_synthesize(text)` — streaming for lower latency
5. Wire into WebSocket handler:
   - When AI generates a response text, convert to audio via ElevenLabs
   - Stream audio bytes back through Twilio media stream:
     ```python
     # Twilio expects base64-encoded mulaw audio in JSON
     media_message = {
         "event": "media",
         "streamSid": stream_sid,
         "media": {"payload": base64.b64encode(audio).decode()}
     }
     await websocket.send_json(media_message)
     ```
6. Test: hardcode a greeting → call → hear Neha speak it clearly

**Done when:** Neha speaks clearly on the phone. Audio quality is natural, not robotic.

---

### Part 2E: Full Call Loop (Hardcoded)
**Owner:** Backend Dev  
**Depends on:** 2B + 2C + 2D  

**Tasks:**
1. Complete the WebSocket handler `/ws/call-stream/{call_id}` with the full loop:
   ```
   Call connects
     → Play greeting via TTS
     → Listen for candidate speech via STT
     → When candidate stops speaking (utterance end)
     → Generate hardcoded response (for now, not Claude yet)
     → Play response via TTS
     → Loop until "goodbye"
     → End call
   ```
2. Handle Twilio media stream protocol:
   - Parse `connected` event → save `streamSid`
   - Parse `start` event → note encoding (mulaw, 8kHz)
   - Parse `media` events → decode audio, forward to Deepgram
   - Parse `stop` event → cleanup
3. Handle call termination:
   - Save final transcript to Supabase `calls.transcript`
   - Save transcript segments to `calls.transcript_segments`
   - Update call status to `completed`
   - Clear Redis state
4. Handle edge cases:
   - Call drops mid-conversation → save partial transcript
   - Candidate doesn't answer → update status to `no_answer`
   - Audio quality issues → log warning
5. Test: full call with hardcoded Q&A. Speak, hear response, speak again, hear next response.

**Done when:** Can have a 3-4 turn conversation with Neha using hardcoded responses. Transcript saved to DB after call ends.

---

### Part 2F: Call Initiation API
**Owner:** Backend Dev  
**Depends on:** 2A + 2B  

**Tasks:**
1. Implement `POST /api/calls/initiate`:
   - Accept: `candidate_id`, `call_type`
   - Look up candidate phone number from DB
   - Create call record in Supabase with status `queued`
   - Call `CallService.initiate_call()` → Twilio makes the call
   - Return `call_id` and `twilio_call_sid`
2. Implement `POST /api/candidates/{id}/calls`:
   - Same as above but takes `call_type` in body
   - Creates call linked to candidate
3. Test: hit API → phone rings → conversation works

**Done when:** Can trigger a call from the API. Phone rings within seconds.

---

### Part 2G: Call Dashboard Page (Frontend)
**Owner:** Frontend Dev  
**Depends on:** 1F + 1D (calls API)  

**Tasks:**
1. Build `app/(dashboard)/calls/page.tsx`:
   - Table showing all calls: candidate name, call type, status, duration, date
   - Filter by: call type, status, date range
   - Status badges: queued (gray), ringing (yellow), in_progress (blue), completed (green), failed (red)
   - Click row → navigate to call detail
2. Build `app/(dashboard)/calls/[id]/page.tsx`:
   - Call metadata: type, candidate, status, duration
   - Audio player (if recording URL available)
   - Transcript display (scrollable, speaker-labeled)
   - Extracted data panel (JSON viewer)
   - AI summary section
3. Add "Trigger Call" button to candidate detail page:
   - Dropdown: select call type
   - Calls `POST /api/candidates/{id}/calls`
   - Shows toast: "Call initiated to {candidate_name}"

**Done when:** Can see call history, play recordings, read transcripts in the dashboard.

---

### Phase 2 Completion Checklist
- [ ] Twilio account set up, phone number purchased
- [ ] Outbound calls work from API
- [ ] Deepgram transcribes speech in real-time
- [ ] ElevenLabs generates natural voice audio
- [ ] Full call loop works with hardcoded responses
- [ ] Transcript saved to database after call
- [ ] Call list and detail pages in dashboard
- [ ] Recording playback works

---

## Phase 3: LangGraph + Screening Call (Week 5–6)

**Goal:** Call 1 (Screening) works fully with Claude driving the conversation.

---

### Part 3A: Claude Integration in LangGraph Nodes
**Owner:** Backend Dev (AI)  
**Depends on:** 2E  

**Tasks:**
1. Create `backend/app/agent/llm.py` — Claude client wrapper:
   - Initialize Anthropic client with API key
   - `generate_response(system_prompt, messages, extracted_data)` → returns AI text + structured extraction
   - Use Claude's tool use / structured output to extract data as JSON alongside conversational text
2. Update each screening node to call Claude:
   - Load the system prompt from `prompts/screening.md`
   - Template in company/candidate context
   - Pass conversation history (all messages so far)
   - Pass what data has been collected and what remains
   - Claude returns: spoken response + extracted JSON data
3. Handle response parsing:
   - Separate spoken text (sent to TTS) from structured data (saved to state)
   - Update `collected_data` in conversation state
   - Update `pending_questions` (remove asked ones)

**Done when:** Claude generates natural, contextual responses for each screening phase. Data is extracted from candidate answers.

---

### Part 3B: Screening Graph — Category A (Demographics)
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement `category_a_demographics` node fully:
   - Define all Category A questions as a checklist
   - On each turn: Claude picks the next unasked question, asks conversationally
   - Extract from response: `current_location`, `open_to_relocation`, `relocation_preferences`, `work_model_preference`, `shift_flexibility`, `employment_status`, `last_working_day`, `reason_for_leaving`, `current_ctc`, `expected_ctc`, `notice_period_days`, `early_release_possible`
   - Handle multi-turn: candidate may give partial info → Claude probes for rest
   - Handle declined answers: mark field as `"declined"`, move on
2. Internal loop within the node:
   ```
   while pending_category_a_questions:
       ai_question = claude.generate(context + remaining_questions)
       play_tts(ai_question)
       candidate_answer = await wait_for_stt()
       extracted = claude.extract(candidate_answer, expected_fields)
       update_state(extracted)
       remove_answered_questions()
   ```
3. Test: full Category A conversation. All fields populated after the section.

**Done when:** Can ask all demographics questions naturally and extract structured data for each.

---

### Part 3C: Screening Graph — Category B (Role-Specific)
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement `category_b_role_specific` node:
   - Branch on `role_type` from the job:
     - `client_facing` → 4 questions about client engagement
     - `team_handling` → 4 questions about team management
     - `technical` → 5 questions about tech stack proficiency
   - Each question set has its own sub-prompt injected into the system prompt
2. Create role-specific prompt templates:
   - `backend/app/agent/prompts/screening_client_facing.md`
   - `backend/app/agent/prompts/screening_team_handling.md`
   - `backend/app/agent/prompts/screening_technical.md`
3. Extract `role_specific_answers` as JSONB — different structure per role type
4. Test each role type: client-facing, team-handling, technical

**Done when:** Role-specific questions asked correctly based on job type. Answers extracted as structured data.

---

### Part 3D: Screening Graph — Category C (Salary) + Scoring
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement `category_c_salary_trajectory` node:
   - Ask about previous CTC, growth %, YoY increments, financial expectations
   - Extract: `previous_ctc`, `ctc_growth_percentage`, `yoy_increments`, `financial_expectations`
2. Implement `score_and_qualify` node:
   - Flesh out `ScoringService.score_candidate()`:
     - Send all collected data + job requirements + scoring weights to Claude
     - Claude returns score (0-100) + breakdown + qualified/unqualified + reason
   - Threshold: score >= 60 → qualified
   - Save score to state
3. Implement `communicate_result` node:
   - If qualified: explain next steps, mention recruiter will follow up
   - If unqualified: polite close with specific reason, don't be vague
4. Implement `goodbye` node:
   - Warm closing
   - Set `should_end_call = True`
   - Set `next_action` based on qualification:
     - Qualified → `"flag_for_hr_review"`
     - Unqualified → `"send_rejection_email"`

**Done when:** Full screening call works end-to-end. Candidate is scored and informed. Data saved.

---

### Part 3E: Post-Call Actions
**Owner:** Backend Dev  
**Depends on:** 3D  

**Tasks:**
1. When call ends and `should_end_call = True`:
   - Save final conversation state from Redis to Supabase:
     - `calls.transcript` — full transcript text
     - `calls.transcript_segments` — timestamped segments
     - `calls.extracted_data` — all collected_data as JSON
     - `calls.ai_summary` — Claude-generated 3-line summary of the call
   - Update `candidates` record:
     - All Category A/B/C fields populated from `extracted_data`
     - `score`, `score_breakdown`, `qualification_status`
     - `stage` → `'screened'` (if qualified) or `'rejected'`
     - `disqualification_reason` (if unqualified)
2. If qualified:
   - Update `candidates.stage` to `'screened'`
   - (HR will manually review and shortlist from dashboard)
3. If unqualified:
   - Send rejection email via `EmailService.send_rejection_email()`
   - Update `candidates.stage` to `'rejected'`
4. Clear Redis state for this call

**Done when:** After call ends, all data flows into the correct database fields. Rejection email sent for unqualified candidates.

---

### Part 3F: Candidate Scorecard UI (Frontend)
**Owner:** Frontend Dev  
**Depends on:** 1D + 3D (scoring data available)  

**Tasks:**
1. Build `app/(dashboard)/candidates/page.tsx`:
   - Table: name, job, stage, score, last contact, date
   - Filter by: stage (dropdown), job (dropdown), score range
   - Search by: name, phone, email
   - Sort by: score, date, stage
   - Stage badges with colors:
     - new (gray), screening (yellow), screened (blue), shortlisted (purple),
       scheduled (indigo), interviewing (orange), offer (green),
       pre_joining (teal), joined (emerald), rejected (red), withdrawn (pink)
2. Build `app/(dashboard)/candidates/[id]/page.tsx`:
   - **Header:** name, phone, email, stage badge, score circle
   - **Scorecard tab:**
     - Overall score (0-100) with colored ring
     - Breakdown bars: location fit, work model, notice period, CTC alignment, role experience, salary trajectory
     - Qualification status + reason
   - **Profile tab:**
     - Category A data: location, relocation, work model, employment, CTC, notice
     - Category B data: role-specific answers
     - Category C data: salary trajectory
   - **Calls tab:**
     - List of all calls with type, date, duration, status
     - Click to expand transcript inline
   - **Timeline tab:**
     - Chronological activity: stage changes, calls, interviews, emails
3. Add action buttons:
   - "Trigger Screening Call" (if stage is `new`)
   - "Shortlist" (if stage is `screened` — moves to `shortlisted`)
   - "Reject" (with reason input)
   - "Schedule Interview" (if stage is `shortlisted`)

**Done when:** Full candidate profile page with scorecard, call history, and action buttons working.

---

### Phase 3 Completion Checklist
- [ ] Claude drives the screening conversation naturally
- [ ] All 3 question categories work (demographics, role-specific, salary)
- [ ] Candidate scored automatically after call
- [ ] Qualified/unqualified determined and communicated
- [ ] Post-call data saved to correct DB fields
- [ ] Rejection email sent for unqualified candidates
- [ ] Candidate scorecard visible in dashboard
- [ ] Full pipeline view with stage management

---

## Phase 4: Interview Scheduling + Calendar (Week 7–8)

**Goal:** Call 2 works — AI reads calendar, calls candidate, books the interview.

---

### Part 4A: Google Calendar OAuth Setup
**Owner:** Backend Dev  
**Depends on:** 1A  

**Tasks:**
1. Create Google Cloud project
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials (Web application type)
4. Set redirect URI: `{BACKEND_URL}/api/auth/google/callback`
5. Copy client ID and secret to `.env`
6. Implement OAuth flow in FastAPI:
   - `GET /api/auth/google` — redirects to Google consent screen
   - `GET /api/auth/google/callback` — exchanges code for tokens, stores in DB
7. Store refresh tokens per interviewer in Supabase (`interviewer_credentials` table or in `companies.settings`)
8. Implement token refresh logic in `CalendarService`

**Done when:** An interviewer can connect their Google Calendar via OAuth. Tokens stored securely.

---

### Part 4B: Calendar Service — Read Availability
**Owner:** Backend Dev  
**Depends on:** 4A  

**Tasks:**
1. Implement `CalendarService.get_available_slots()` fully:
   - Query Google FreeBusy API for interviewer's calendar
   - Also query HR rep's calendar (cross-reference)
   - Compute free slots within working hours (configurable: 9am–6pm IST)
   - Filter: only include slots >= `duration_minutes` long
   - Return 3-5 best slots across next 5 business days
   - Skip weekends and company holidays (if configured)
2. Implement `CalendarService._compute_free_slots()`:
   - Generate all possible slots (30-min increments within working hours)
   - Remove slots overlapping with busy periods
   - Group by day for easy presentation
3. Test: connect a real Google Calendar with events → verify free slots returned correctly

**Done when:** Can read real interviewer availability and return valid free slots.

---

### Part 4C: Calendar Service — Block Slots & Create Events
**Owner:** Backend Dev  
**Depends on:** 4A  

**Tasks:**
1. Implement `CalendarService.block_slot()` fully:
   - Create event in interviewer's calendar
   - Add candidate as attendee (optional — depends on company preference)
   - Auto-generate Google Meet link (`conferenceData`)
   - Set event description with interview details
2. Implement `CalendarService.cancel_event()`:
   - Delete event when candidate drops
   - Free the slot
3. Create interview record in Supabase when slot is blocked:
   - `google_event_id` stored for future cancellation
   - `meeting_link` stored for reminder call
4. Test: block a slot → see it in Google Calendar → cancel it → slot freed

**Done when:** Events appear in Google Calendar with Meet links. Cancellation works.

---

### Part 4D: Scheduling Call Graph (LangGraph)
**Owner:** Backend Dev (AI)  
**Depends on:** 3A + 4B + 4C  

**Tasks:**
1. Implement `scheduling.greeting` — inform candidate they're shortlisted
2. Implement `scheduling.read_calendar_slots`:
   - Call `CalendarService.get_available_slots()`
   - Format slots for conversational presentation
3. Implement `scheduling.present_slots`:
   - Claude reads available slots and presents them naturally:
     "I have a few options for you. Tuesday the 15th at 2 PM, Wednesday the 16th at 10 AM, or Thursday the 17th at 3 PM. Which works best?"
   - Handle candidate selecting a slot (by number, day, or time)
   - Handle "none work" → offer HR callback
4. Implement `scheduling.confirm_slot`:
   - Repeat confirmed slot details back to candidate
   - Confirm interview format (video/in-person/phone)
   - Mention interviewer name
5. Implement `scheduling.block_calendars`:
   - Call `CalendarService.block_slot()` — block in all calendars
   - Call `EmailService.send_calendar_invite()` — email candidate
   - Create `interviews` record in Supabase
   - Update `candidates.stage` to `'scheduled'`
6. Implement `scheduling.goodbye` — confirm everything, end call
7. Handle edge cases:
   - Candidate is unsure, wants to check and call back
   - Candidate asks about interview format/location
   - No slots available (interviewer fully booked)

**Done when:** Full scheduling call works. Slot booked in Google Calendar. Candidate emailed. Interview record created.

---

### Part 4E: Interview Schedule Page (Frontend)
**Owner:** Frontend Dev  
**Depends on:** 1D (interviews API)  

**Tasks:**
1. Build `app/(dashboard)/interviews/page.tsx`:
   - Calendar view (week/day toggle) showing scheduled interviews
   - List view alternative with table
   - Color-code by status: scheduled (blue), confirmed (green), completed (gray), cancelled (red)
   - Each event shows: candidate name, job, interviewer, time, format
   - Click event → detail panel or page
2. Build `app/(dashboard)/interviews/[id]/page.tsx`:
   - Interview details: candidate, job, interviewer, time, format, meeting link
   - Status badge
   - Feedback section (if submitted): display ratings and comments
   - Action buttons: cancel, reschedule, mark complete
3. Add "Schedule Interview" flow from candidate detail page:
   - HR clicks "Schedule Interview" on a shortlisted candidate
   - Modal: select interviewer, interview type
   - On submit: triggers scheduling call via API
   - Dashboard shows interview as `scheduled`

**Done when:** Can view all interviews on a calendar, see details, and trigger scheduling from candidate page.

---

### Phase 4 Completion Checklist
- [ ] Google Calendar OAuth working for interviewers
- [ ] Free slots computed correctly from real calendar data
- [ ] Scheduling call works end-to-end with Claude
- [ ] Calendar events created with Google Meet links
- [ ] Candidate emailed with interview confirmation
- [ ] Interview record created in database
- [ ] Interview calendar view in dashboard
- [ ] Schedule interview action from candidate page

---

## Phase 5: Reminders + Results (Week 9–10)

**Goal:** Calls 3 (pre-interview reminder) and 4 (post-interview result) work automatically.

---

### Part 5A: Reminder Call Graph
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement all `reminder` graph nodes:
   - `greeting` — remind about today's interview
   - `confirm_attendance` — check if candidate is still coming
   - Route: attending → logistics; dropping → free slot + notify HR
   - `share_logistics` — time, location/link, interviewer, documents
   - `goodbye` — wish luck
2. If candidate drops:
   - Cancel Google Calendar event
   - Update interview status to `cancelled`
   - Update candidate stage
   - Notify HR (email or dashboard notification)
3. Prompt: create `backend/app/agent/prompts/reminder.md`

**Done when:** Reminder call confirms attendance and shares logistics. Dropouts handled cleanly.

---

### Part 5B: Reminder Background Worker
**Owner:** Backend Dev  
**Depends on:** 5A + 1E  

**Tasks:**
1. Implement `backend/app/workers/call_scheduler.py`:
   - Runs every 15 minutes (use APScheduler or FastAPI lifespan)
   - Query: find interviews where `scheduled_at` is ~2 hours from now AND `candidate_reminded = false`
   - For each: trigger reminder call via `CallService.initiate_call(call_type="reminder_candidate")`
   - Mark `candidate_reminded = true`
2. Implement interviewer email trigger:
   - Same query as above but for `interviewer_reminded = false`
   - Send candidate summary email via `EmailService.send_candidate_summary()`
   - Mark `interviewer_reminded = true`
3. Wire worker into FastAPI app startup:
   ```python
   @app.on_event("startup")
   async def start_workers():
       scheduler.start()
   ```
4. Test: create interview 2 hours from now → worker picks it up → call fires → email sent

**Done when:** Reminders fire automatically 2 hours before interviews. No manual trigger needed.

---

### Part 5C: Result Call Graph
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement all `result` graph nodes:
   - `greeting` — set context for result update
   - `communicate_result` — branch on interview outcome:
     - **Pass + more rounds:** congratulate, explain next round, will schedule soon
     - **Pass + final:** congratulate, hand off to human HR for offer call
     - **Hold:** set timeline expectation, reassure
     - **Fail:** polite, respectful close with encouragement
   - `goodbye` — end call
2. Post-call actions based on result:
   - Pass + more rounds: update stage, trigger scheduling for next round
   - Pass + final: update stage to `'offer'`, notify HR
   - Fail: update stage to `'rejected'`, send email
3. Prompt: create `backend/app/agent/prompts/result.md`

**Done when:** Result call communicates outcome naturally. Pipeline stage updates automatically.

---

### Part 5D: Feedback Collection System
**Owner:** Backend Dev + Frontend Dev  
**Depends on:** 1D  

**Tasks:**
1. **Backend:**
   - Implement feedback form dispatch: after interview `status` changes to `completed`, send email to interviewer
   - `POST /api/interviews/{id}/feedback` — accept structured feedback JSON
   - Auto-link feedback to candidate profile
   - Implement feedback reminder: if not submitted in 2 hours, send reminder email
   - Add to background worker: check for overdue feedback every 30 min
2. **Frontend:**
   - Build feedback form page: `app/(dashboard)/interviews/[id]/feedback/page.tsx`
     - Rating scales (1-5): technical skills, communication, culture fit, overall
     - Text areas: strengths, areas of concern, additional notes
     - Recommendation: strong yes / yes / maybe / no / strong no
     - Submit button
   - Show feedback status on interview detail page
   - Show feedback on candidate profile page

**Done when:** Interviewers receive feedback form email, can fill it out, feedback shows on candidate profile.

---

### Phase 5 Completion Checklist
- [ ] Reminder calls fire 2 hours before interview automatically
- [ ] Interviewer gets candidate summary email before interview
- [ ] Candidate dropout during reminder → slot freed, HR notified
- [ ] Result call communicates outcome based on interview result
- [ ] Pipeline stage updates automatically after result call
- [ ] Feedback form dispatched to interviewer after interview
- [ ] Feedback reminder sent if not submitted in 2 hours
- [ ] Feedback visible on candidate profile

---

## Phase 6: Pre-Joining + Exit (Week 11–12)

**Goal:** Calls 5 (pre-joining) and 6 (exit interview) work.

---

### Part 6A: Pre-Joining Call — Track A (Short Notice)
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement Track A nodes:
   - Confirm joining date, time, location
   - Brief on documents, reporting person, dress code
   - Detect withdrawal: "I've taken another offer"
     → Ask reason, log, notify HR, update stage to `withdrawn`
   - Detect disengagement: vague, non-committal
     → Re-engage, address concerns, reconfirm
2. Dropout detection worker:
   - If 48 hours after offer letter and candidate hasn't responded to any outreach
   - Auto-trigger pre-joining call
3. Prompt: create `backend/app/agent/prompts/pre_joining.md`

**Done when:** Short-notice joiners get confirmed. Dropouts detected and flagged.

---

### Part 6B: Pre-Joining Call — Track B (Long Notice)
**Owner:** Backend Dev (AI)  
**Depends on:** 6A  

**Tasks:**
1. Implement Track B engagement check nodes:
   - Check LWD status (on track, early release, extended)
   - Gauge engagement through conversational cues:
     - Enthusiasm level (excited vs. flat)
     - Responsiveness (quick answers vs. hesitant)
     - Questions asked (engaged candidates ask about the role, team)
     - Competing offer signals (mentions other interviews, stalling)
   - Claude scores engagement (1-10) and flags concerns
2. Implement engagement cadence worker:
   - Every 2-3 weeks during notice period
   - Query candidates with stage `pre_joining` AND notice period > 30 days
   - Schedule check-in calls
3. Final call (1-2 days before Day 1): switch to Track A logistics flow
4. HR alert system:
   - If engagement drops below threshold → email HR with details
   - If competing offer detected → priority alert to HR
   - Dashboard notification for flagged candidates

**Done when:** Long-notice candidates get regular engagement calls. Disengagement detected early.

---

### Part 6C: Exit Interview Call
**Owner:** Backend Dev (AI)  
**Depends on:** 3A  

**Tasks:**
1. Implement all `exit_call` graph nodes:
   - Reason for leaving (with follow-up probing)
   - Manager experience (1-5 rating + qualitative)
   - Team experience (1-5 rating + qualitative)
   - Culture rating (1-5 + specifics)
   - One thing to change (open-ended)
2. Post-call processing:
   - Auto-transcribe full conversation
   - Claude generates structured summary
   - Auto-tag themes: `compensation`, `growth`, `management`, `culture`, `work_life_balance`, `relocation`, `better_offer`
   - Tag metadata: team, manager, tenure band, function
   - Save to `exit_interviews` table
3. Prompt: create `backend/app/agent/prompts/exit_call.md`

**Done when:** Exit interview conducted, transcribed, tagged, and summarized automatically.

---

### Part 6D: Exit Analytics
**Owner:** Frontend Dev  
**Depends on:** 6C  

**Tasks:**
1. Backend: `GET /api/analytics/exit-patterns`:
   - Aggregate exit reasons by frequency
   - Breakdown by team, manager, tenure band
   - Trend over time (monthly)
   - Average ratings: manager, team, culture
2. Frontend: add exit analytics section to `app/(dashboard)/analytics/page.tsx`:
   - Bar chart: top exit reasons
   - Heatmap: exit reasons by team/manager
   - Trend line: exits per month
   - Average rating gauges: manager, team, culture
   - Filter by: date range, department, team

**Done when:** Exit patterns visible in analytics dashboard. Can filter by team/manager to spot issues.

---

### Phase 6 Completion Checklist
- [ ] Pre-joining Track A: short-notice joiners confirmed
- [ ] Pre-joining Track B: long-notice engagement calls every 2-3 weeks
- [ ] Dropout detection at 48 hours post-offer
- [ ] Engagement scoring and disengagement alerts to HR
- [ ] Exit interview call works end-to-end
- [ ] Auto-transcription, tagging, and summary
- [ ] Exit pattern analytics in dashboard

---

## Phase 7: HR Helpdesk (Week 13–14)

**Goal:** Employees can call Neha for common HR queries. Queries resolved or escalated.

---

### Part 7A: Inbound Call Handling
**Owner:** Backend Dev  
**Depends on:** 2B  

**Tasks:**
1. Configure Twilio phone number for inbound calls (not just outbound)
2. Implement inbound voice webhook:
   - When someone calls the Neha number → identify as helpdesk call
   - Create call record with `call_type = "helpdesk"`
   - Open media stream → start helpdesk graph
3. Optional: set up IVR menu:
   - "Press 1 for HR helpdesk, Press 2 to connect to your recruiter"
   - Route accordingly

**Done when:** Employees can call the Neha number and reach the helpdesk agent.

---

### Part 7B: Helpdesk Conversation Graph
**Owner:** Backend Dev (AI)  
**Depends on:** 7A + 3A  

**Tasks:**
1. Implement `helpdesk.greeting`:
   - Collect employee name and ID
   - Look up employee in database (or create record)
2. Implement `helpdesk.identify_query`:
   - Claude classifies query into one of 5 buckets:
     1. Team/Manager/Work (→ escalate to Reporting Manager, CC HR)
     2. Time & Attendance (→ escalate to HR T&A team)
     3. Payroll (→ escalate to Payroll & Finance)
     4. HR Documentation (→ escalate to HR Compliance)
     5. IT Helpdesk (→ escalate to IT Support)
   - Claude determines if it can resolve directly or needs escalation
3. Implement `helpdesk.resolve_or_escalate`:
   - **Direct resolution:** answer factual questions from company knowledge base
     - Leave balance, holiday calendar, salary breakup, document request process
   - **Escalation:** create ticket with full context, notify relevant team
4. Implement `helpdesk.anything_else`:
   - Loop back for multiple queries in one call
5. Knowledge base:
   - Create `backend/app/agent/prompts/helpdesk.md` with company policy templates
   - Configurable per company via `companies.settings`
6. Prompt: create `backend/app/agent/prompts/helpdesk.md`

**Done when:** Helpdesk call routes queries correctly. Simple queries resolved. Complex ones escalated with tickets.

---

### Part 7C: Helpdesk Ticket System
**Owner:** Backend Dev + Frontend Dev  
**Depends on:** 7B  

**Tasks:**
1. **Backend:**
   - Ticket creation on escalation: employee, bucket, query, call transcript, assigned team
   - Ticket update: status (open → resolved / escalated), resolution notes
   - Notification to relevant team via email
2. **Frontend:** build `app/(dashboard)/helpdesk/page.tsx`:
   - Ticket table: employee, bucket, query summary, status, date
   - Filter by: bucket, status
   - Click ticket → detail page with:
     - Full query details
     - Associated call transcript
     - Resolution notes
     - Status update controls

**Done when:** Tickets created from calls, visible in dashboard, resolvable by HR.

---

### Phase 7 Completion Checklist
- [ ] Inbound calls handled on Neha's phone number
- [ ] Queries classified into correct buckets
- [ ] Simple queries resolved directly on call
- [ ] Complex queries escalated with full context
- [ ] Tickets created in database
- [ ] Ticket management page in dashboard
- [ ] Notification emails to relevant teams

---

## Phase 8: Analytics, Polish & Deploy (Week 15–16)

**Goal:** Analytics dashboard complete. Production-ready. Deployed.

---

### Part 8A: Hiring Funnel Analytics
**Owner:** Frontend Dev + Backend Dev  
**Depends on:** 1D  

**Tasks:**
1. Backend: `GET /api/analytics/funnel`:
   - Count candidates at each stage per job
   - Conversion rates between stages
   - Average time in each stage
   - Drop-off points
2. Frontend: funnel visualization:
   - Funnel chart: new → screened → shortlisted → scheduled → interviewing → offer → joined
   - Conversion % between each stage
   - Filter by: job, date range
   - Click stage → see candidates at that stage

**Done when:** Visual hiring funnel with conversion rates.

---

### Part 8B: Call Analytics
**Owner:** Frontend Dev + Backend Dev  
**Depends on:** 1D  

**Tasks:**
1. Backend: `GET /api/analytics/calls`:
   - Total calls by type, by day/week/month
   - Average call duration by type
   - Success rate (completed vs. failed/no-answer)
   - Calls per candidate average
2. Frontend: call metrics dashboard:
   - Line chart: calls over time (by type)
   - Bar chart: avg duration by call type
   - Pie chart: call outcomes
   - KPI cards: total calls today, avg duration, success rate

**Done when:** Call volume and quality metrics visible.

---

### Part 8C: Dashboard Overview Page
**Owner:** Frontend Dev  
**Depends on:** 8A + 8B  

**Tasks:**
1. Build `app/(dashboard)/page.tsx` — the main dashboard:
   - **Today's calls:** upcoming scheduled calls, in-progress calls
   - **Pending actions:** candidates to review, feedback overdue, interviews to schedule
   - **KPI cards:** open positions, active candidates, interviews this week, offers pending
   - **Quick funnel:** mini funnel chart
   - **Recent activity:** latest calls, stage changes, feedback submissions
2. Real-time updates via Supabase Realtime:
   - Call status changes (queued → in_progress → completed)
   - New candidates added
   - Feedback submitted

**Done when:** Dashboard overview shows actionable summary of current state.

---

### Part 8D: Settings Page
**Owner:** Frontend Dev  
**Depends on:** 1D  

**Tasks:**
1. Build `app/(dashboard)/settings/page.tsx`:
   - **Company profile:** name, domain, logo
   - **Call configuration:**
     - Default working hours for scheduling
     - Interview duration options
     - Consent message (played at start of recorded calls)
   - **Scoring criteria:**
     - Adjustable weights for each scoring category
     - Pass/fail threshold
   - **Integrations status:**
     - Google Calendar: connected/disconnected + connect button
     - Twilio: phone number, account status
   - **Notification preferences:**
     - Which events trigger emails
     - Email recipients per event type

**Done when:** HR can configure company settings without touching code.

---

### Part 8E: Error Handling & Edge Cases
**Owner:** Backend Dev  
**Depends on:** All prior phases  

**Tasks:**
1. Call failure handling:
   - Candidate doesn't answer → retry after 1 hour, max 3 attempts
   - Call drops mid-conversation → save partial state, offer resume option
   - STT fails (no transcript) → fall back to simpler prompts
   - TTS fails → use Twilio's built-in `<Say>` as fallback
2. API error handling:
   - Google Calendar API rate limits → exponential backoff
   - Twilio rate limits → queue management
   - Claude API errors → retry with backoff
   - Supabase connection errors → health check endpoint
3. Data validation:
   - Phone number formatting (E.164)
   - Email validation
   - CTC values sanity checks
4. Logging:
   - Structured logging (JSON) for all services
   - Call event logging (start, transcript chunk, response, end)
   - Error tracking (Sentry or similar)

**Done when:** System handles failures gracefully. No unhandled crashes. Retries work.

---

### Part 8F: Security & Compliance
**Owner:** Backend Dev  
**Depends on:** All prior phases  

**Tasks:**
1. API authentication:
   - All endpoints require valid Supabase JWT
   - Webhook endpoints validated (Twilio signature verification)
   - Rate limiting on public endpoints
2. Data protection:
   - PII fields identified and documented
   - Data retention policy: configurable auto-delete after X months
   - Call recordings: access-controlled, not publicly accessible
3. CORS: restrict to production frontend domain
4. Call consent: Neha announces "this call may be recorded" at the start
5. Input sanitization: prevent injection in all user inputs

**Done when:** Security review passed. No obvious vulnerabilities.

---

### Part 8G: Production Deployment
**Owner:** DevOps / Full-stack  
**Depends on:** 8E + 8F  

**Tasks:**
1. Frontend deployment (Vercel):
   - Connect GitHub repo
   - Set environment variables
   - Configure custom domain (if applicable)
   - Verify build succeeds
2. Backend deployment (Railway or Fly.io):
   - Create project, link repo
   - Set all environment variables
   - Verify WebSocket support works
   - Configure custom domain for stable webhook URLs
3. Update Twilio webhooks to production URLs
4. Update Google OAuth redirect URIs to production
5. Update CORS in FastAPI to production frontend domain
6. Smoke test:
   - Sign up → dashboard loads
   - Create job → create candidate → trigger screening call → full call works
   - Scheduling call → calendar event created
   - Check analytics page loads
7. Monitor: set up health checks and uptime monitoring

**Done when:** System running in production. Full flow works end-to-end with real calls.

---

### Phase 8 Completion Checklist
- [ ] Hiring funnel analytics with conversion rates
- [ ] Call metrics dashboard
- [ ] Overview page with pending actions and KPIs
- [ ] Settings page for company configuration
- [ ] Error handling and retry logic
- [ ] Security hardened (auth, CORS, rate limiting, consent)
- [ ] Deployed to Vercel + Railway
- [ ] Production smoke test passed

---

## Quick Reference: Who Works on What

| Part | Backend Dev | AI/LLM Dev | Frontend Dev |
|------|:-----------:|:----------:|:------------:|
| 1A Backend setup | X | | |
| 1B Supabase DB | X | | |
| 1C SQLAlchemy models | X | | |
| 1D CRUD APIs | X | | |
| 1E Redis setup | X | | |
| 1F Dashboard shell | | | X |
| 1G Auth | | | X |
| 2A–2F Voice engine | X | | |
| 2G Call dashboard | | | X |
| 3A Claude integration | | X | |
| 3B–3D Screening call | | X | |
| 3E Post-call actions | X | X | |
| 3F Scorecard UI | | | X |
| 4A–4C Calendar service | X | | |
| 4D Scheduling call | | X | |
| 4E Interview UI | | | X |
| 5A Reminder call | | X | |
| 5B Reminder worker | X | | |
| 5C Result call | | X | |
| 5D Feedback system | X | | X |
| 6A–6B Pre-joining | | X | |
| 6C Exit interview | | X | |
| 6D Exit analytics | | | X |
| 7A Inbound calls | X | | |
| 7B Helpdesk graph | | X | |
| 7C Ticket system | X | | X |
| 8A–8C Analytics | X | | X |
| 8D Settings | | | X |
| 8E Error handling | X | X | |
| 8F Security | X | | |
| 8G Deployment | X | | X |

---

## Parallel Work Opportunities

These parts can be worked on simultaneously by different people:

**Week 1–2:**
- Backend Dev: 1A + 1B + 1C + 1D + 1E (all backend setup)
- Frontend Dev: 1F + 1G (dashboard shell + auth)

**Week 3–4:**
- Backend Dev: 2A + 2B + 2C + 2D + 2E + 2F (entire voice engine)
- Frontend Dev: 2G + start on 3F (call pages + candidate UI)

**Week 5–6:**
- AI Dev: 3A + 3B + 3C + 3D (Claude + screening call)
- Backend Dev: 3E (post-call actions) + 4A (Google Calendar OAuth)
- Frontend Dev: 3F (scorecard UI)

**Week 7–8:**
- AI Dev: 4D (scheduling call graph)
- Backend Dev: 4B + 4C (calendar read/write)
- Frontend Dev: 4E (interview UI)

**Week 9–10:**
- AI Dev: 5A + 5C (reminder + result calls)
- Backend Dev: 5B + 5D backend (workers + feedback API)
- Frontend Dev: 5D frontend (feedback form)

**Week 11–12:**
- AI Dev: 6A + 6B + 6C (pre-joining + exit calls)
- Frontend Dev: 6D (exit analytics)

**Week 13–14:**
- AI Dev: 7B (helpdesk graph)
- Backend Dev: 7A + 7C backend (inbound calls + tickets)
- Frontend Dev: 7C frontend (ticket management)

**Week 15–16:**
- Backend Dev: 8E + 8F + 8G (hardening + deploy)
- Frontend Dev: 8A + 8B + 8C + 8D (analytics + dashboard + settings)
