# Neha - Detailed Call Flow Scripts

> Each call type below includes the exact conversation flow, LangGraph node sequence, data collected, and actions triggered.

---

## Call 1: Screening / First Contact Call

**Trigger:** HR marks a candidate's CV as shortlisted in the dashboard  
**LangGraph:** `screening_graph`  
**Duration:** ~8-12 minutes  

### Node Sequence

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi, am I speaking with {candidate_name}? This is Neha calling
  from {company_name}. {recruiter_name} from our hiring team asked me to
  reach out to you regarding the {job_title} position you applied for.
  Is this a good time to talk?"
  
  → If no: "No problem at all. When would be a good time to call back?"
    → Log callback time, schedule retry, END
  → If yes: proceed
  │
  ▼
[confirm_interest] ──────────────────────────────────────────────────
  Neha: "Great! Before we begin, I just want to confirm — are you still
  interested in exploring this opportunity with us?"
  
  → If no: "Completely understand. Thank you for your time. May I ask
    what changed?" → Log reason, END
  → If yes: proceed
  │
  ▼
[explain_process] ──────────────────────────────────────────────────
  Neha: "Wonderful. I'll walk you through a quick 10-minute conversation
  where I'll ask a few questions about your background and preferences.
  Based on that, our team will review your profile and get back to you
  with next steps. Shall we begin?"
  │
  ▼
[category_a_location] ──────────────────────────────────────────────
  Neha: "Let's start with the basics. Which city and state are you
  currently based in?"
  → Extract: current_location
  
  Neha: "Got it. Would you be open to relocating for this role, or do
  you prefer to stay in {current_location}?"
  → Extract: open_to_relocation, relocation_preferences
  │
  ▼
[category_a_work_model] ────────────────────────────────────────────
  Neha: "This role is {work_model}. Are you comfortable with that
  arrangement?"
  → Extract: work_model_preference
  
  Neha: "And regarding office timings — this position involves
  {shift_info}. Does that work for you?"
  → Extract: shift_flexibility
  │
  ▼
[category_a_employment] ────────────────────────────────────────────
  Neha: "Are you currently employed, serving a notice period, or
  between jobs at the moment?"
  → Extract: employment_status
  
  If not employed:
    Neha: "When was your last working day, and what was the primary
    reason for the transition?"
    → Extract: last_working_day, reason_for_leaving
  │
  ▼
[category_a_compensation] ──────────────────────────────────────────
  Neha: "Could you share your current CTC? A broad breakup would be
  helpful — like your fixed component, variable pay, and any other
  components like ESOPs or bonuses."
  → Extract: current_ctc {fixed, variable, esops, bonus}
  
  Neha: "And what's your expected CTC range for this move? Any specific
  non-negotiables?"
  → Extract: expected_ctc {min, max, non_negotiables}
  │
  ▼
[category_a_notice] ────────────────────────────────────────────────
  Neha: "How long is your notice period? And is there a possibility of
  getting an early release?"
  → Extract: notice_period_days, early_release_possible
  │
  ▼
[category_b_role_specific] ─────────────────────────────────────────
  
  === IF role_type == "client_facing" ===
  Neha: "Now a few questions about your experience. Have you held a
  client-facing role before?"
  → "Was it external clients or internal stakeholders?"
  → "What was the nature — advisory, relationship management, sales,
     support, or delivery?"
  → "How many clients or accounts were you managing at a time?"
  
  === IF role_type == "team_handling" ===
  Neha: "Have you managed a team before? If yes, for how long?"
  → "What was the team size — direct reports vs indirect?"
  → "Would you be comfortable starting with a smaller team initially?"
  → "Have you been involved in hiring or onboarding team members?"
  
  === IF role_type == "technical" ===
  Neha: "Do you have hands-on experience with {tech_stack_from_jd}?"
  → "How recently did you work with these? Currently, last 6 months,
     or longer?"
  → "How would you rate your proficiency — beginner, working knowledge,
     advanced, or leading projects independently?"
  → "Have you worked on live production deployments?"
  → "Any certifications or notable projects you'd like to mention?"
  
  → Extract: role_specific_answers (JSONB)
  │
  ▼
[category_c_salary_trajectory] ─────────────────────────────────────
  Neha: "Before we wrap up, I'd like to understand your career
  trajectory a bit. What was your CTC with the employer before your
  current one? How much growth did you see in that move?"
  → Extract: previous_ctc, ctc_growth_percentage
  
  Neha: "Within your current or last role — have you received annual
  increments? Roughly what percentage?"
  → Extract: yoy_increments
  
  Neha: "Lastly, are there any joining-related financial expectations
  we should be aware of? Like a notice period buyout, joining bonus,
  or sign-on amount?"
  → Extract: financial_expectations
  │
  ▼
[score_and_qualify] ────────────────────────────────────────────────
  # Internal: Claude scores based on company criteria
  # Score = weighted sum of:
  #   - Location/relocation fit (10%)
  #   - Work model match (10%)
  #   - Notice period fit (15%)
  #   - CTC alignment (20%)
  #   - Role-specific experience (30%)
  #   - Salary trajectory (15%)
  
  → IF qualified:
    Neha: "Thank you so much for your time, {candidate_name}. Based on
    our conversation, your profile looks like a strong fit. Our recruiter
    {recruiter_name} will review everything and get in touch with next
    steps within the next 2-3 business days."
    → Action: Update stage to 'screened', flag for HR review
    
  → IF unqualified:
    Neha: "Thank you for your time, {candidate_name}. After reviewing
    your responses, I think there may be a mismatch on {reason} for this
    particular role. We'll keep your profile on file and reach out if
    something better aligned comes up. I'll also send you an email with
    more details."
    → Action: Update stage to 'rejected', send rejection email via SendGrid
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "Thank you again. Have a wonderful day!"
  → END CALL
  → Save: transcript, score, extracted_data, ai_summary to Supabase
  → Clear: Redis call state
```

---

## Call 2: Interview Scheduling Call

**Trigger:** HR approves candidate and assigns interviewer  
**Prerequisite:** Interviewer's Google Calendar is connected  
**LangGraph:** `scheduling_graph`  
**Duration:** ~3-5 minutes  

### Node Sequence

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {candidate_name}, this is Neha from {company_name} again.
  I'm calling with good news — our team has reviewed your profile and
  would like to schedule an interview with you for the {job_title} role."
  │
  ▼
[read_calendar] ─────────────────────────────────────────────────────
  # Internal: Fetch interviewer's Google Calendar availability
  # Generate 3-5 available slots in the next 5 business days
  # Cross-reference with HR calendar
  │
  ▼
[present_slots] ─────────────────────────────────────────────────────
  Neha: "I have a few slots available. Let me share them with you:
  Option 1: {day}, {date} at {time}
  Option 2: {day}, {date} at {time}
  Option 3: {day}, {date} at {time}
  Which one works best for you?"
  
  → If candidate picks a slot: proceed
  → If none work:
    Neha: "No worries. I'll have {recruiter_name} reach out to find
    a time that works better. They'll call you within the next day."
    → Action: Flag for HR to manually schedule, END
  │
  ▼
[confirm_slot] ──────────────────────────────────────────────────────
  Neha: "Perfect. So I'm confirming your interview for {day}, {date}
  at {time}. The interview will be {format: in-person/video/phone}.
  {If video: You'll receive a Google Meet link.}
  {If in-person: The address is {office_address}.}
  You'll be speaking with {interviewer_name}. Does that all sound good?"
  
  → Confirm: yes/no
  │
  ▼
[block_calendars] ───────────────────────────────────────────────────
  # Internal actions (all parallel):
  # 1. Block slot in interviewer's Google Calendar
  # 2. Block slot in HR calendar
  # 3. Create Google Meet link (if video)
  # 4. Send calendar invite email to candidate via SendGrid
  # 5. Create interview record in Supabase
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "All set! I've sent you a calendar invite with all the details.
  You'll also receive a reminder call 2 hours before the interview.
  Best of luck, {candidate_name}!"
  → END CALL
```

---

## Call 3: Pre-Interview Reminder

**Trigger:** Automated — 2 hours before scheduled interview  
**LangGraph:** `reminder_graph`  
**Duration:** ~2-3 minutes  

### To Candidate (Voice Call)

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {candidate_name}, this is Neha from {company_name}. I'm
  calling to remind you about your interview scheduled today at {time}."
  │
  ▼
[confirm_attendance] ────────────────────────────────────────────────
  Neha: "Can you confirm you'll be able to make it?"
  
  → If yes: proceed to logistics
  → If no/dropping:
    Neha: "I understand. I'll free up the slot and let the team know.
    Would you like to reschedule for another time?"
    → Action: Cancel interview, free calendar slots, notify HR
    → If reschedule: trigger scheduling_graph, END
    → If no: update stage, END
  │
  ▼
[logistics] ─────────────────────────────────────────────────────────
  Neha: "Great. Just to confirm the details:
  - Time: {time} today
  - {If video: Your meeting link is in the calendar invite you received}
  - {If in-person: The office is at {address}. Please report to
    {reception_contact} at the front desk}
  - You'll be speaking with {interviewer_name}
  - {If documents needed: Please carry {documents_list}}
  
  Any questions before we wrap up?"
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "Wishing you all the best, {candidate_name}. You'll do great!"
  → END CALL
```

### To Interviewer (Email — not a call)

```
Subject: Interview Reminder - {candidate_name} for {job_title} | Today at {time}

Hi {interviewer_name},

This is a reminder that you have an interview scheduled today:

📋 Candidate Summary
─────────────────────
Name:               {candidate_name}
Role Applied For:   {job_title}
Current Employer:   {current_employer}
Previous Employer:  {previous_employer}
Experience:         {years} years
Key Skills:         {skills_list}
Current CTC:        {current_ctc}
Expected CTC:       {expected_ctc}

📌 Screening Highlights
{ai_summary_from_screening_call}

⏰ Interview Details
Time:     {time}
Format:   {format}
{If video: Link: {google_meet_link}}
{If in-person: Room: {room_number}}

Should you have any queries about this candidate ahead of the interview,
please connect with {recruiter_name} from the HR team.

Best,
Neha (AI HR Assistant)
```

---

## Call 4: Post-Interview Result Call

**Trigger:** HR updates interview result in dashboard  
**LangGraph:** `result_graph`  
**Duration:** ~2-4 minutes  

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {candidate_name}, this is Neha from {company_name}. I'm
  calling to update you on your recent interview."
  │
  ▼
[communicate_result] ────────────────────────────────────────────────

  === IF result == "pass" AND more_rounds_pending ===
  Neha: "I'm happy to let you know that you've cleared the {round_name}
  round. The team was impressed with your conversation. There's one more
  round ahead — {next_round_description}. I'll be in touch shortly to
  schedule that. Congratulations!"
  → Action: Re-enter scheduling_graph for next round
  
  === IF result == "pass" AND final_round ===
  Neha: "Congratulations! You've successfully cleared all interview
  rounds. {recruiter_name} from our HR team will be reaching out to you
  directly to discuss the next steps. Exciting times ahead!"
  → Action: Update stage to 'offer', notify HR for final decision call
  
  === IF result == "hold" ===
  Neha: "Thank you for your patience, {candidate_name}. The team is
  still evaluating a few candidates for this round. We expect to have
  an update for you within {timeline}. We haven't forgotten about you!"
  
  === IF result == "fail" ===
  Neha: "Thank you for taking the time to interview with us,
  {candidate_name}. After careful consideration, the team has decided
  to move forward with other candidates for this particular role.
  This doesn't reflect on your abilities — it's about the specific fit
  for this position. We'll keep your profile active and reach out if
  something more aligned comes up. You'll also receive an email with
  more details."
  → Action: Update stage to 'rejected', send email
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  → END CALL

---
POST-CALL ACTION: Feedback Form to Interviewer

# Triggered immediately after interview ends (not after result call)
# Email sent to interviewer with structured feedback form link
# If not submitted within 2 hours, reminder email sent
```

---

## Call 5: Pre-Joining Confirmation

### Track A: Short Notice (7-15 days)

**Trigger:** 1-2 days after offer letter issued, OR 48hrs no response  
**LangGraph:** `pre_joining_graph` (track_a)  
**Duration:** ~3-5 minutes  

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {candidate_name}, this is Neha from {company_name}.
  Congratulations again on your offer! I'm calling to confirm everything
  for your joining."
  │
  ▼
[confirm_joining] ───────────────────────────────────────────────────
  Neha: "Your joining date is set for {joining_date}. Can you confirm
  you'll be joining us as planned?"
  
  → If yes: proceed
  → If taken another offer:
    Neha: "I understand. Could you share what made you decide to go
    in a different direction? This helps us improve."
    → Log reason, notify HR, mark as 'withdrawn', END
  → If unsure/disengaged:
    Neha: "Is there anything we can help clarify? Any concerns about
    the role or the offer?"
    → Re-engage, reconfirm plan
  │
  ▼
[day1_logistics] ────────────────────────────────────────────────────
  Neha: "Here are a few things for Day 1:
  - Please arrive at {office_address} by {time}
  - Report to {person_name} at {location}
  - Please carry: {documents_list}
  - {dress_code_info if applicable}
  
  Any questions about your first day?"
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "We're excited to have you on board, {candidate_name}. See you
  on {joining_date}!"
  → END CALL
```

### Track B: Long Notice (2+ months)

**Trigger:** Every 2-3 weeks during notice period  
**LangGraph:** `pre_joining_graph` (track_b)  
**Duration:** ~5-8 minutes  

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {candidate_name}, this is Neha from {company_name}.
  Just checking in — how's everything going?"
  │
  ▼
[notice_period_check] ──────────────────────────────────────────────
  Neha: "Is your last working day still on track for {last_working_day}?
  Any changes to the notice period — early release or extension?"
  → Extract: lwd_status, any_changes
  │
  ▼
[competing_offers_check] ───────────────────────────────────────────
  Neha: "Are you still feeling good about joining us? I just want to
  make sure everything's on track from your end."
  # Conversational cues analyzed:
  # - Enthusiasm level
  # - Responsiveness
  # - Questions they ask (sign of engagement)
  # - Hesitation or vague responses (sign of disengagement)
  → Extract: engagement_signals, competing_offer_indicators
  │
  ▼
[engagement_score] ──────────────────────────────────────────────────
  # Internal: Claude scores engagement based on conversational cues
  # If disengagement detected → flag to HR immediately
  # If competing offer suspected → flag to HR with priority
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "Thanks for the update, {candidate_name}. We're looking forward
  to having you join the team. I'll check in again in a couple of weeks.
  Feel free to reach out if you have any questions in the meantime."
  → END CALL

  # On final call (1-2 days before Day 1):
  # Switch to Track A logistics flow
```

---

## Call 6: Exit / Alumni Call

**Trigger:** Employee resignation logged in system  
**LangGraph:** `exit_graph`  
**Duration:** ~10-15 minutes  

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi {employee_name}, this is Neha from {company_name} HR. I
  understand you've decided to move on, and I'd like to have a brief
  conversation about your experience with us. Everything you share is
  confidential and will be used to help us improve. Is this a good time?"
  │
  ▼
[reason_for_leaving] ───────────────────────────────────────────────
  Neha: "First, could you share your primary reason for leaving?"
  → Follow up based on response (better offer, growth, management,
    work-life balance, relocation, etc.)
  → Extract: reason_for_leaving, sub_reasons
  │
  ▼
[manager_experience] ───────────────────────────────────────────────
  Neha: "How would you describe your experience working with your
  reporting manager? On a scale of 1 to 5, how would you rate that
  relationship?"
  → Extract: manager_rating, manager_feedback
  │
  ▼
[team_experience] ──────────────────────────────────────────────────
  Neha: "And how about your team? How was the working dynamic? Same
  scale, 1 to 5."
  → Extract: team_rating, team_feedback
  │
  ▼
[culture_rating] ───────────────────────────────────────────────────
  Neha: "Overall, how would you rate the company culture? Anything
  specific that stood out — positively or negatively?"
  → Extract: culture_rating, culture_feedback
  │
  ▼
[suggestions] ──────────────────────────────────────────────────────
  Neha: "If there was one thing you could change about working here,
  what would it be?"
  → Extract: suggestions
  │
  ▼
[goodbye] ──────────────────────────────────────────────────────────
  Neha: "Thank you so much for your honest feedback, {employee_name}.
  This really helps us improve. We wish you all the best in your next
  chapter. You're always welcome back."
  → END CALL
  
  → Action: Auto-transcribe, tag themes, generate summary
  → Action: Add tags (team:{team}, manager:{manager}, tenure:{tenure})
  → Action: Feed into exit pattern analysis
```

---

## HR Helpdesk Call (Inbound)

**Trigger:** Employee calls the Neha helpdesk number  
**LangGraph:** `helpdesk_graph`  

```
START
  │
  ▼
[greeting] ──────────────────────────────────────────────────────────
  Neha: "Hi, you've reached the HR helpdesk. This is Neha. Could I
  have your name and employee ID, please?"
  → Extract: employee_name, employee_id
  │
  ▼
[identify_query] ───────────────────────────────────────────────────
  Neha: "How can I help you today? Please describe your query."
  → Claude classifies into one of 5 buckets:
    1. Team/Manager/Work Related
    2. Time & Attendance
    3. Payroll Related
    4. HR Documentation
    5. IT Helpdesk
  │
  ▼
[resolve_or_escalate] ──────────────────────────────────────────────

  === IF factual/process query (can resolve directly) ===
  Neha: "{answer based on company policy/knowledge base}"
  → Log resolution, END
  
  === IF needs escalation ===
  Neha: "I understand your concern. Let me route this to the right
  team. I'm creating a ticket with all the details you've shared.
  {escalation_team} will get back to you within {SLA}. Your ticket
  number is {ticket_id}."
  → Create helpdesk_ticket with full context
  → Notify escalation team
  → END
  │
  ▼
[anything_else] ────────────────────────────────────────────────────
  Neha: "Is there anything else I can help with?"
  → If yes: loop back to identify_query
  → If no: "Have a great day!"
  → END CALL
```
