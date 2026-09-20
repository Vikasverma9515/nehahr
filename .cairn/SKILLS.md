# Agent skills

Written by `cairn build` from the manifest. The assistant reads the matching skill before it plans a request. Re-run `cairn build` after the UI changes.

## Start AI call with a candidate

_Triggers an immediate AI phone call to a candidate from the dashboard._

Feature: Start AI call with a candidate
Page: /dashboard
Triggers an immediate AI phone call to a candidate from the dashboard.

Use it when the person says things like:
- have Neha phone the candidate now
- start an AI call
- call candidate

Requires:
- Be on the dashboard page
- Have a candidate to call

Steps:
1. Click the start-ai-call button [control: start-ai-call] -> Button shows 'Calling...' and then 'Call initiated' upon success.

What it reaches:
- server-action POST triggerCall http://localhost:8000/api/calls/initiate: Initiates an AI phone call (screening, etc.) to the candidate via the backend API

Fields and rules:
- candidateId (required): Valid candidate ID
- callType (required): Call type string (default: 'screening')

Result: Initiates an AI phone call to the candidate and displays 'Call initiated' on success or an error message on failure.

Watch out:
- Requires the backend API service to be reachable at BACKEND_API_URL.

## Shortlist a candidate

_Moves a screened candidate to the shortlisted stage._

Feature: Shortlist a candidate
Page: /dashboard
Moves a screened candidate to the shortlisted stage.

Use it when the person says things like:
- shortlist a candidate
- move candidate to shortlist

Requires:
- Be on the dashboard page
- A candidate ready for shortlist

Steps:
1. Click the Shortlist button for the candidate [control: shortlist-candidate] -> Button changes to 'Shortlisted' indicating success.

What it reaches:
- server-action POST shortlistCandidate: Updates candidate stage to 'shortlisted' in Supabase

Fields and rules:
- candidateId (required): Valid candidate ID

Result: Updates candidate stage to 'shortlisted' and updates the button state to 'Shortlisted'.

Watch out:
- Changes candidate stage in database.

## Reject a candidate

_Rejects a candidate with confirmation._

Feature: Reject a candidate
Page: /dashboard
Rejects a candidate with confirmation.

Use it when the person says things like:
- reject a candidate
- turn down applicant

Requires:
- Be on the dashboard page
- A candidate to reject

Steps:
1. Click the Reject button [control: reject-candidate] -> Confirmation prompt appears ('Reject this candidate?') with 'Yes, reject' and 'Cancel' buttons.
2. Click 'Yes, reject' [control: confirm-reject-candidate] -> Candidate is rejected and removed from pending action queues.

What it reaches:
- server-action POST rejectCandidate: Updates candidate stage to 'rejected' and qualification status to 'unqualified' in Supabase

Fields and rules:
- candidateId (required): Valid candidate ID
- reason: Optional disqualification reason string

Result: Prompts for confirmation, then marks the candidate as rejected and updates the UI.

Watch out:
- Irreversibly changes candidate stage to rejected.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Mark interview complete

_Marks a scheduled interview as completed._

Feature: Mark interview complete
Page: /dashboard
Marks a scheduled interview as completed.

Use it when the person says things like:
- mark interview complete
- finish interview meeting

Requires:
- Be on the dashboard page
- An interview scheduled for today

Steps:
1. Click 'Mark Complete' on an interview card and confirm the browser alert [control: mark-interview-complete] -> Interview status updates and page refreshes.

What it reaches:
- server-action POST markInterviewCompleted http://localhost:8000/api/interviews/{interviewId}/complete: Marks an interview as completed via backend API

Fields and rules:
- interviewId (required): Valid interview ID

Result: Confirms action via browser dialog, marks interview completed, requests interviewer feedback, and refreshes page.

Watch out:
- Triggers browser confirmation dialog.

## Submit interview feedback

_Submits evaluation feedback and results for a completed interview._

Feature: Submit interview feedback
Page: /dashboard
Submits evaluation feedback and results for a completed interview.

Use it when the person says things like:
- submit interview feedback
- evaluate candidate interview

Requires:
- Be on the dashboard page
- An interview to submit feedback for

Steps:
1. Click 'Submit Feedback' [control: submit-interview-feedback] -> Feedback modal opens with rating inputs, recommendation dropdown, result options, and text areas.
2. Fill out the feedback form and click Submit [control: submit-interview-feedback] -> Feedback is submitted, modal closes, and dashboard refreshes.

What it reaches:
- server-action POST submitFeedback http://localhost:8000/api/interviews/{interviewId}/feedback: Submits interview feedback scores and recommendations via backend API

Fields and rules:
- technical_skills (required): Number from 1 to 5 (default 3)
- communication (required): Number from 1 to 5 (default 3)
- culture_fit (required): Number from 1 to 5 (default 3)
- overall (required): Number from 1 to 5 (default 3)
- recommendation (required): 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'
- result (required): 'pass' | 'hold' | 'fail'
- strengths: Text string
- concerns: Text string
- notes: Text string

Result: Opens feedback modal, submits scores, recommendation, result, and notes, closes modal, and refreshes dashboard.

Watch out:
- Requires valid rating selections and result status.

## Cancel interview meeting

_Cancels a scheduled interview meeting._

Feature: Cancel interview meeting
Page: /dashboard
Cancels a scheduled interview meeting.

Use it when the person says things like:
- cancel interview
- cancel meeting

Requires:
- Be on the dashboard page
- A scheduled interview meeting

Steps:
1. Click the cancel interview control [control: cancel-interview-meeting] -> Interview meeting is cancelled.

What it reaches:
- server-action POST cancelInterview http://localhost:8000/api/interviews/{interviewId}/cancel: Cancels a scheduled interview via backend API

Fields and rules:
- interviewId (required): Valid interview ID
- reason: Cancellation reason
- reschedule: Boolean (default true)

Result: Cancels the scheduled interview meeting.

Watch out:
- Cancels the meeting appointment.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Send result or offer email

_Previews and sends offer, rejection, or result update emails to candidates based on interview outcomes._

Feature: Send result or offer email
Page: /dashboard
Previews and sends offer, rejection, or result update emails to candidates based on interview outcomes.

Use it when the person says things like:
- send result email
- send offer email
- send rejection email

Requires:
- Be on the dashboard page
- An interview with a submitted result

Steps:
1. Click 'Send Offer/Rejection/Update Email' [control: send-result-email] -> Email preview modal opens with pre-filled template.
2. Review or edit recipient email, subject, and body, then click send [control: send-result-email] -> Email is sent, success message appears, and modal closes after 2 seconds.

What it reaches:
- server-action GET getEmailTemplate http://localhost:8000/api/interviews/{interviewId}/email-template: Fetches email template from backend API
- server-action POST sendResultEmail http://localhost:8000/api/interviews/{interviewId}/send-email: Sends result or offer email to candidate via backend API

Fields and rules:
- to_email (required): Valid email address
- subject (required): Email subject line
- body (required): Email body text

Result: Opens email preview modal, loads template, allows editing recipient, subject, and body, and sends email to candidate.

Watch out:
- Sends a real email to the candidate.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## View voice call overview and statistics

_View voice call system overview, stats, live calls, and queued calls._

Feature: View voice call overview and statistics
Page: /dashboard/calls
View voice call system overview, stats, live calls, and queued calls.

Use it when the person says things like:
- check live calls
- view call statistics
- see call overview

Requires:
- Be on the /dashboard/calls page

Steps:
1. Review the statistics strip (Calls Today, Completed, Avg Duration, Completion Rate, Queued Next) -> Stats update based on today's calls and upcoming interviews.
2. Inspect the Live Now section if any live calls exist -> Shows ongoing calls with candidate name, call type, and elapsed time.

What it reaches:
- database select calls: Fetch call records joined with candidate info
- database select interviews: Fetch pending interview reminders and results

Result: Displays call statistics, live calls list, queued auto-calls, and tab navigation.

Watch out:
- Live calls and stats are read-only summaries.

## Switch between call tabs

_Switch between Overview, Today, and All Calls tabs._

Feature: Switch between call tabs
Page: /dashboard/calls
Switch between Overview, Today, and All Calls tabs.

Use it when the person says things like:
- view today's calls
- view all calls history

Requires:
- Be on the /dashboard/calls page

Steps:
1. Click the 'Today' or 'All Calls' tab in the tabs bar -> URL updates with the corresponding tab query parameter and the call list updates.

What it reaches:
- database select calls: Fetch call records with candidate info

Fields and rules:
- tab: Accepted values: overview, today, all

Result: Filters calls list based on the selected tab (Overview, Today, All Calls).

Watch out:
- Tab selection is reflected via the URL query parameter 'tab'.

## Open live call details

_Open the detail view for a specific live call._

Feature: Open live call details
Page: /dashboard/calls
Open the detail view for a specific live call.

Use it when the person says things like:
- inspect a live call
- view ongoing call details

Requires:
- A live call must be present in the Live Now section

Steps:
1. Click on a live call card [control: call with m s elapsed] -> Navigates to the specific call detail page at /dashboard/calls/[id].

What it reaches:
- database select calls: Fetch call records

Result: Navigates to the individual call detail page.

Watch out:
- Only available when live calls are currently in progress or ringing.

## View Call Details, Recording, Transcript, AI Summary, and Extracted Data

_View complete details of a specific candidate call including audio recording, parsed transcript, AI summary, and structured candidate data._

Feature: View Call Details, Recording, Transcript, AI Summary, and Extracted Data
Page: /dashboard/calls/[id]
View complete details of a specific candidate call including audio recording, parsed transcript, AI summary, and structured candidate data.

Use it when the person says things like:
- review a call
- listen to call recording
- check call transcript
- view AI summary of call
- inspect extracted call data

Requires:
- A valid call ID in the route parameters

Steps:
1. Navigate to /dashboard/calls/[id] -> The page loads displaying the call header, recording player (if available), transcript, AI summary, and extracted data.

What it reaches:
- database select supabase.from("calls"): Fetch call details and associated candidate info by call ID
- external GET /api/calls/[id]/recording /api/calls/[id]/recording: Stream or download the call audio recording

Fields and rules:
- id (required): UUID string representing the call record

Result: Displays call metadata (type, candidate name, status, duration, timestamp), an audio player for the recording, the parsed transcript between Neha and the candidate, the AI-generated summary, and structured extracted candidate data.

Watch out:
- If the call ID does not exist in the database, a 404 Not Found error is triggered.

## Search candidates

_Search candidates by name, email, or phone number._

Feature: Search candidates
Page: /dashboard/candidates
Search candidates by name, email, or phone number.

Use it when the person says things like:
- search for a candidate by name
- find candidate by email
- filter candidates by phone number

Requires:
- Be on /dashboard/candidates

Steps:
1. Type a search term into the search input field for name, email, or phone -> The search parameter is updated in the URL query string and matching candidates are displayed.

What it reaches:
- database select candidates: Query candidates table with ilike search filter and order by created_at desc, limit 200
- database select jobs: Query open jobs for job filter tabs

Fields and rules:
- q: Text query matching name, email, or phone (case-insensitive ilike)

Result: The candidate list updates to show only candidates matching the search query string.

Watch out:
- Search is limited to the latest 200 candidates matching the query.

## Filter candidates by pipeline stage

_Filter the candidate pipeline by stage tabs._

Feature: Filter candidates by pipeline stage
Page: /dashboard/candidates
Filter the candidate pipeline by stage tabs.

Use it when the person says things like:
- view candidates who need action
- see shortlisted candidates
- view candidates in a specific hiring stage

Requires:
- Be on /dashboard/candidates

Steps:
1. Click on one of the stage tab buttons (Action, All, New, Screening, Screened, Shortlisted, Scheduled, Interviewing, Done) -> The page reloads with the corresponding stage filter applied, showing the count for each tab.

What it reaches:
- database select candidates: Fetch candidates to filter by stage and job
- database select jobs: Fetch open jobs

Result: The candidate list filters to display only candidates in the selected stage tab (Action, All, New, Screening, Screened, Shortlisted, Scheduled, Interviewing, Done).

Watch out:
- Tabs preserve existing search query and job filters.

## Trigger AI Screening Call

_Triggers an AI phone screening call to the candidate._

Feature: Trigger AI Screening Call
Page: /dashboard/candidates/[id]
Triggers an AI phone screening call to the candidate.

Use it when the person says things like:
- call the candidate
- trigger screening call
- phone candidate with AI

Requires:
- Candidate profile page open

Steps:
1. Click start-ai-call [control: start-ai-call] -> Button shows 'Calling...' and then 'Call initiated' message upon success.

What it reaches:
- server-action POST triggerCall http://localhost:8000/api/calls/initiate: Initiates an AI screening call to the candidate via backend API

Result: Initiates a phone call to the candidate and displays a 'Call initiated' status message.

Watch out:
- Requires valid candidate phone number and backend call service configured.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Shortlist Candidate

_Shortlists the candidate for the role._

Feature: Shortlist Candidate
Page: /dashboard/candidates/[id]
Shortlists the candidate for the role.

Use it when the person says things like:
- shortlist candidate
- move candidate to shortlist

Requires:
- Candidate profile page open

Steps:
1. Click Shortlist [control: Shortlist] -> Button updates to show 'Shortlisted' with a check icon.

What it reaches:
- server-action POST shortlistCandidate supabase candidates table update: Updates candidate stage to shortlisted in database

Result: Changes candidate stage to 'shortlisted' and updates page UI.

Watch out:
- Changes candidate stage permanently.

## Reject Candidate

_Rejects the candidate for the role after confirmation._

Feature: Reject Candidate
Page: /dashboard/candidates/[id]
Rejects the candidate for the role after confirmation.

Use it when the person says things like:
- reject candidate
- turn down applicant
- fail candidate

Requires:
- Candidate profile page open

Steps:
1. Click Reject [control: Reject] -> Confirmation prompt appears with 'Yes, reject' and 'Cancel' buttons.
2. Click confirm-reject-candidate [control: confirm-reject-candidate] -> Candidate is rejected and status is updated.

What it reaches:
- server-action POST rejectCandidate supabase candidates table update: Updates candidate stage to rejected and marks qualification as unqualified

Result: Changes candidate stage to rejected, sets qualification to unqualified, and updates page UI.

Watch out:
- Irreversibly rejects the candidate and updates qualification status.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Submit Interview Feedback

_Submits structured evaluation feedback for an interview round._

Feature: Submit Interview Feedback
Page: /dashboard/candidates/[id]
Submits structured evaluation feedback for an interview round.

Use it when the person says things like:
- submit interview feedback
- evaluate candidate interview
- add interview notes and scores

Requires:
- An interview exists for the candidate

Steps:
1. Click Submit Feedback [control: submit-interview-feedback] -> Feedback modal dialog opens with rating sliders, recommendation, result, and text fields.
2. Fill out feedback ratings, recommendation, result, and optional text fields, then click Submit [control: Submit Feedback] -> Modal closes and page refreshes with saved feedback.

What it reaches:
- server-action POST submitFeedback http://localhost:8000/api/interviews/{interviewId}/feedback: Submits interview feedback scores and recommendation to backend

Fields and rules:
- technical_skills (required): Number from 1 to 5, default 3
- communication (required): Number from 1 to 5, default 3
- culture_fit (required): Number from 1 to 5, default 3
- overall (required): Number from 1 to 5, default 3
- recommendation (required): strong_yes | yes | maybe | no | strong_no, default maybe
- result (required): pass | hold | fail, default hold
- strengths: Free text
- concerns: Free text
- notes: Free text

Result: Submits feedback for an interview round and refreshes the page.

Watch out:
- Requires an active interview round.

## Send Result Email

_Previews and sends an offer, rejection, or update email to the candidate._

Feature: Send Result Email
Page: /dashboard/candidates/[id]
Previews and sends an offer, rejection, or update email to the candidate.

Use it when the person says things like:
- send offer email
- send rejection email
- email candidate result

Requires:
- An interview exists with a result

Steps:
1. Click send-result-email [control: send-result-email] -> Email template modal opens with pre-populated recipient, subject, and body.
2. Review or edit email details and click Send Email [control: Send Email] -> Email is sent and confirmation message is displayed before modal closes.

What it reaches:
- server-action POST sendResultEmail http://localhost:8000/api/interviews/{interviewId}/send-email: Sends result email (offer/rejection/update) to candidate

Fields and rules:
- to_email (required): Valid email address
- subject (required): Email subject line
- body (required): Email body text

Result: Sends an email to the candidate and displays a success confirmation.

Watch out:
- Sends a real email to the candidate. Cannot be undone once sent.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Add a new candidate

_Manually register a new candidate into the hiring pipeline by entering their details and optionally linking them to an open job._

Feature: Add a new candidate
Page: /dashboard/candidates/new
Manually register a new candidate into the hiring pipeline by entering their details and optionally linking them to an open job.

Use it when the person says things like:
- add a candidate
- register a new candidate
- create candidate profile

Requires:
- Navigate to /dashboard/candidates/new

Steps:
1. Type the candidate's full name into the Full Name field [control: name] -> Full Name field populated
2. Type the candidate's phone number into the Phone Number field [control: phone] -> Phone Number field populated
3. Type the candidate's email address into the Email field (optional) [control: email] -> Email field populated
4. Select an open job from the Job dropdown list (optional) [control: job_id] -> Selected job chosen
5. Click Add Candidate [control: Add Candidate] -> Candidate is saved and browser redirects to the candidates list page

What it reaches:
- database insert candidates: Inserts a new candidate record into the candidates table
- server-action POST createCandidate: Server action handling form submission and candidate insertion

Fields and rules:
- name (required): Text string, non-empty
- phone (required): Phone number format (tel type)
- email: Email format, stored as null if empty
- job_id: UUID of an open job, stored as null if empty

Result: Saves the new candidate and redirects to the candidates list page (/dashboard/candidates)

Watch out:
- Full name and phone number are required fields.

## View employee support tickets

_View and monitor employee support tickets and their statuses on the Helpdesk page._

Feature: View employee support tickets
Page: /dashboard/helpdesk
View and monitor employee support tickets and their statuses on the Helpdesk page.

Use it when the person says things like:
- view support tickets
- check helpdesk tickets
- monitor employee issues

Requires:
- Be logged in to the dashboard

Steps:
1. Click the Helpdesk link in the navigation sidebar [control: a-112] -> Displays the Helpdesk page showing support tickets grouped by Open and Resolved status.

What it reaches:
- database select helpdesk_tickets: Fetches up to 50 employee support tickets ordered by creation date descending.

Fields and rules:
- status: filtered into open/escalated and resolved groups

Result: Displays support tickets grouped into Open and Resolved sections with employee name, category bucket, status badge, query text snippet, and creation date.

Watch out:
- Only the latest 50 tickets are displayed.

## Filter and view interviews by time tab and job

_View and filter candidate interviews by time period and job title._

Feature: Filter and view interviews by time tab and job
Page: /dashboard/interviews
View and filter candidate interviews by time period and job title.

Use it when the person says things like:
- view my schedule
- check interviews this week
- filter interviews by job
- see past interviews
- check action items

Requires:
- Navigate to /dashboard/interviews

Steps:
1. Click on a job filter link (e.g., 'All Jobs' or a specific job title) to filter interviews by job. -> URL updates with the job query param and the interview list re-filters.
2. Click on a time tab ('Today', 'This Week', 'Later', 'Action', 'Past') to view interviews in that timeframe. -> The active tab changes and the list shows interviews grouped by day (or flat list for Past).

What it reaches:
- database select interviews: Query all scheduled, completed, and cancelled interviews with candidate, job, and interviewer relations.
- database select jobs: Fetch open jobs for the job filter bar.

Fields and rules:
- tab: Values: 'today' (default), 'week', 'upcoming', 'action', 'past'.
- job: Job ID UUID or empty for all jobs.

Result: The interview list updates to display interviews matching the selected time tab and/or job filter.

Watch out:
- Tabs with a count of 0 are disabled and cannot be clicked.

## Mark an interview as completed

_Mark a scheduled interview as completed to trigger feedback collection._

Feature: Mark an interview as completed
Page: /dashboard/interviews
Mark a scheduled interview as completed to trigger feedback collection.

Use it when the person says things like:
- mark interview done
- finish interview
- complete interview call

Requires:
- An upcoming or scheduled interview in the list.

Steps:
1. Click the 'Mark Complete' button on an interview card. [control: Mark Complete] -> A browser confirm dialog appears: 'Mark this interview as completed? This will request feedback from the interviewer.'
2. Click OK on the confirmation dialog. -> The backend marks the interview completed and the page refreshes.

What it reaches:
- external POST /api/interviews/{interviewId}/complete http://localhost:8000/api/interviews/{interviewId}/complete: Mark an interview as completed and request interviewer feedback.

Fields and rules:
- interviewId (required): UUID of the interview record.

Result: Interview is marked as completed, prompting feedback collection, and the page refreshes.

Watch out:
- Requires confirming the prompt. Cannot be undone directly from this button.

## Submit interview feedback

_Submit interviewer evaluation ratings, notes, and final recommendation/result for a candidate interview._

Feature: Submit interview feedback
Page: /dashboard/interviews
Submit interviewer evaluation ratings, notes, and final recommendation/result for a candidate interview.

Use it when the person says things like:
- submit feedback
- grade interview
- write interview notes
- evaluate candidate interview

Requires:
- An interview that requires feedback (or clicking Submit Feedback on an interview).

Steps:
1. Click the 'Submit Feedback' button on an interview item. [control: Submit Feedback] -> The interview feedback modal dialog opens.
2. Select ratings for Technical Skills, Communication, Culture Fit, and Overall (1-5). -> Radio buttons are selected.
3. Choose a Recommendation ('strong_yes', 'yes', 'maybe', 'no', 'strong_no') and Result ('pass', 'hold', 'fail'). -> Options are selected.
4. Fill in Strengths, Concerns, and Additional Notes as needed. -> Text areas are populated.
5. Click Submit (or save feedback). -> Feedback is submitted to the backend and modal closes.

What it reaches:
- external POST /api/interviews/{interviewId}/feedback http://localhost:8000/api/interviews/{interviewId}/feedback: Submit interview ratings, recommendations, strengths, concerns, notes, and result.

Fields and rules:
- technical_skills (required): Number from 1 to 5 (default 3).
- communication (required): Number from 1 to 5 (default 3).
- culture_fit (required): Number from 1 to 5 (default 3).
- overall (required): Number from 1 to 5 (default 3).
- recommendation (required): 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' (default 'maybe').
- result (required): 'pass' | 'hold' | 'fail' (default 'hold').
- strengths: String.
- concerns: String.
- notes: String.

Result: Feedback modal opens, and upon submission, feedback is saved and the page refreshes.

Watch out:
- If submission fails, an error message appears inside the modal.

## Send result email to candidate

_Preview and send offer, rejection, or update result emails to candidates after an interview._

Feature: Send result email to candidate
Page: /dashboard/interviews
Preview and send offer, rejection, or update result emails to candidates after an interview.

Use it when the person says things like:
- send email to candidate
- send offer email
- send rejection email
- communicate interview result

Requires:
- An interview with submitted feedback or pending result communication.

Steps:
1. Click the 'Send [Offer/Rejection/Update] Email' button on an interview item. [control: send-result-email] -> The email preview modal opens, fetching the email template.
2. Review or edit the 'To', 'Subject', and 'Email Body' fields. -> Fields update with your text.
3. Click the send email action button. -> Email is sent to the candidate, success state is shown for 2 seconds, then modal closes and page refreshes.

What it reaches:
- external POST /api/interviews/{interviewId}/send-email http://localhost:8000/api/interviews/{interviewId}/send-email: Send result email (offer, rejection, or update) to the candidate.

Fields and rules:
- to_email (required): Valid email address format.
- subject (required): Email subject line.
- body (required): Email body text.

Result: Email template is loaded, editable, and when sent, delivers the email to the candidate and refreshes the page.

Watch out:
- This contacts a real person/candidate via email. Ensure subject and body are correct before sending.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Create a new job

_Click the 'Create Job' button to start creating a new job posting._

Feature: Create a new job
Page: /dashboard/jobs
Click the 'Create Job' button to start creating a new job posting.

Use it when the person says things like:
- create a new job
- add a job posting
- post a new position

Requires:
- Be on the Jobs page (/dashboard/jobs)

Steps:
1. Click the Create Job button in the page header or empty state. [control: Create Job] -> The browser navigates to the job creation page at /dashboard/jobs/new.

What it reaches:
- database select jobs: Fetch all job postings ordered by created_at descending
- database select candidates: Fetch candidate job_id and stage for stats calculation
- http GET /dashboard/jobs/new /dashboard/jobs/new: Navigate to the create job form

Result: Navigates to the job creation page at /dashboard/jobs/new.

Watch out:
- None

## View job details and candidate pipeline

_Click on any job posting in the list to view its details, candidate list, and pipeline stages._

Feature: View job details and candidate pipeline
Page: /dashboard/jobs
Click on any job posting in the list to view its details, candidate list, and pipeline stages.

Use it when the person says things like:
- view a job
- check candidate pipeline for a job
- open job details

Requires:
- Be on the Jobs page (/dashboard/jobs)
- At least one job row must be visible in the list

Steps:
1. Click on a job row in the open or paused/closed list. [control: a-125] -> The browser navigates to the specific job's detail page at /dashboard/jobs/[id].

What it reaches:
- database select jobs: Fetch all job postings ordered by created_at descending
- database select candidates: Fetch candidate job_id and stage for stats calculation
- http GET /dashboard/jobs/[id] /dashboard/jobs/[id]: Navigate to the selected job detail page

Result: Navigates to the detailed view for the selected job.

Watch out:
- None

## Assign or change default interviewer for a job

_Assigns or removes a default interviewer for the job so Neha can use their calendar for scheduling._

Feature: Assign or change default interviewer for a job
Page: /dashboard/jobs/[id]
Assigns or removes a default interviewer for the job so Neha can use their calendar for scheduling.

Use it when the person says things like:
- Change the default interviewer for this job
- Set default interviewer
- Remove default interviewer

Requires:
- Be on the Job Detail page (/dashboard/jobs/[id])
- Active interviewers exist in the system

Steps:
1. Select an interviewer from the dropdown (or select 'None') [control: JobInterviewerPicker select] -> The select value updates and the Save button becomes enabled.
2. Click Save [control: JobInterviewerPicker Save button] -> The button shows a loading spinner briefly, then displays a checkmark and 'Saved', and the page refreshes.

What it reaches:
- database update jobs: Updates the default_interviewer_id for the job

Fields and rules:
- select element value (interviewer ID or empty string): Must be a valid UUID of an active interviewer or empty string to set None

Result: Updates the job's default interviewer in Supabase, shows a checkmark indicating success, and refreshes the page route.

Watch out:
- The Save button is disabled if the selected interviewer is already the current default interviewer or while a save is pending.

## Filter candidate pipeline by stage

_Filters the candidate pipeline list by recruitment stage._

Feature: Filter candidate pipeline by stage
Page: /dashboard/jobs/[id]
Filters the candidate pipeline list by recruitment stage.

Use it when the person says things like:
- View candidates in a specific stage
- Filter pipeline by stage

Requires:
- Be on the Job Detail page (/dashboard/jobs/[id])

Steps:
1. Click a stage tab (e.g., 'All', 'screening', 'shortlisted', etc.) [control: All or stage stage tab link] -> The page updates to display candidates matching the selected stage and highlights the active tab.

What it reaches:
- database select candidates: Filters candidates by stage or displays all candidates for this job

Fields and rules:
- stage searchParam: Must be one of the valid stage keys or omitted for all

Result: Navigates to the same job detail page with the stage query parameter set, displaying only candidates in that stage.

Watch out:
- Stages with 0 candidates are hidden from the tab list.

## Create a new job posting

_Create a new open position and configure its default interview settings by filling out and submitting the job creation form._

Feature: Create a new job posting
Page: /dashboard/jobs/new
Create a new open position and configure its default interview settings by filling out and submitting the job creation form.

Use it when the person says things like:
- add a new job
- create a job posting
- post a new position

Requires:
- Be on the New Job page (/dashboard/jobs/new)

Steps:
1. Type the job title into the Job Title field [control: title] -> Job Title field contains the text
2. (Optional) Type the department name into the Department field [control: department] -> Department field is filled
3. (Optional) Type the location into the Location field [control: location] -> Location field is filled
4. (Optional) Select a work model from the Work Model dropdown [control: work_model] -> Selected work model is chosen
5. (Optional) Select a role type from the Role Type dropdown [control: role_type] -> Selected role type is chosen
6. (Optional) Type comma-separated skills into the Required Skills field [control: required_skills] -> Required skills are entered
7. (Optional) Type the minimum salary into the Salary Min field [control: salary_min] -> Minimum salary is entered
8. (Optional) Type the maximum salary into the Salary Max field [control: salary_max] -> Maximum salary is entered
9. (Optional) Select a default interviewer from the Default Interviewer dropdown [control: default_interviewer_id] -> Selected interviewer is chosen
10. (Optional) Select a format from the Format dropdown [control: default_interview_type] -> Selected format is chosen
11. (Optional) Enter interview duration in minutes into the Duration field [control: default_duration] -> Duration is entered
12. (Optional) Enter total interview rounds (1-5) into the Total Rounds field [control: total_rounds] -> Total rounds is entered
13. (Optional) Enter job description into the Job Description field [control: job_description] -> Job description is entered
14. Click Create Job [control: Create Job] -> Job is created in the database and browser redirects to /dashboard/jobs

What it reaches:
- server-action POST createJob /dashboard/jobs/new: Inserts a new job record into the database table jobs and redirects to /dashboard/jobs
- database insert supabase.from("jobs").insert: Saves the job details and default interview settings into the database

Fields and rules:
- title (required): text string
- department: text string
- location: text string
- work_model: Select: office, hybrid, remote
- role_type: Select: technical, client_facing, team_handling, other
- required_skills: comma-separated string parsed into an array
- salary_min: number (LPA)
- salary_max: number (LPA)
- default_interviewer_id: select from active interviewers list
- default_interview_type: select: video, in_person, phone (defaults to video)
- default_duration: number in minutes (defaults to 60)
- total_rounds: integer between 1 and 5 (defaults to 1)
- job_description: textarea text

Result: Saves the job to the database and navigates to the jobs list page (/dashboard/jobs).

Watch out:
- Job Title is required and the form submission will fail if it is left blank.

## Cancel job creation

_Cancel creating a new job and return to the jobs list page._

Feature: Cancel job creation
Page: /dashboard/jobs/new
Cancel creating a new job and return to the jobs list page.

Use it when the person says things like:
- cancel creating a job
- discard job form

Requires:
- Be on the New Job page (/dashboard/jobs/new)

Steps:
1. Click Cancel [control: Cancel] -> Navigates to /dashboard/jobs

What it reaches:
- other GET navigation /dashboard/jobs: Discards the form and returns to the jobs list page

Result: Discards the current form input and navigates back to the jobs list page (/dashboard/jobs).

Watch out:
- Any unsaved changes entered in the form will be lost.

## Connect HR Email

_Connects a dedicated HR email account for sending interview confirmation emails._

Feature: Connect HR Email
Page: /dashboard/settings
Connects a dedicated HR email account for sending interview confirmation emails.

Use it when the person says things like:
- connect hr email
- link hr gmail account
- set up hr sender

Requires:
- Be on /dashboard/settings

Steps:
1. Click Connect HR Email [control: Connect HR Email] -> Browser redirects to Google OAuth consent screen

What it reaches:
- other GET window.location.href ${PUBLIC_BACKEND_URL}/api/auth/google/start-hr: Navigates to backend OAuth start endpoint for HR Google login

Fields and rules:
- Google OAuth credentials (required): Must authenticate with a valid Google account via OAuth consent screen

Result: Redirects the user's browser to Google OAuth consent screen, then back to the app with hr_sender_connected=1.

Watch out:
- Requires PUBLIC_BACKEND_URL to be configured and backend to be running.

## Disconnect HR sender

_Disconnects the currently connected HR sender email account._

Feature: Disconnect HR sender
Page: /dashboard/settings
Disconnects the currently connected HR sender email account.

Use it when the person says things like:
- disconnect hr sender
- remove hr email account

Requires:
- An HR sender account must currently be connected

Steps:
1. Click the trash icon button (Disconnect HR sender) [control: Disconnect HR sender] -> Confirmation dialog appears. Click OK to confirm. Page refreshes with HR sender disconnected.

What it reaches:
- server-action DELETE disconnectHrSender http://localhost:8000/api/hr-sender/: Calls backend DELETE /api/hr-sender/ to disconnect the HR sender account

Result: Disconnects the HR sender account, refreshes the page, and booking emails fall back to the individual interviewer's Gmail.

Watch out:
- Irreversible action that changes how booking emails are sent.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Add interviewer

_Adds a new recruiting team interviewer with name, email, timezone, and working hours._

Feature: Add interviewer
Page: /dashboard/settings
Adds a new recruiting team interviewer with name, email, timezone, and working hours.

Use it when the person says things like:
- add interviewer
- create new interviewer
- add team member

Requires:
- Be on /dashboard/settings

Steps:
1. Click Add interviewer to toggle open the form [control: Add interviewer] -> Interviewer form fields appear
2. Type the interviewer's name into the Name field [control: name] -> Name is entered
3. Type the interviewer's email into the Email field [control: email] -> Email is entered
4. Type or keep the default timezone [control: timezone] -> Timezone is set
5. Set start hour (0-23) [control: working_hours_start] -> Start hour is set
6. Set end hour (1-24) [control: working_hours_end] -> End hour is set
7. Click Add Interviewer submit button [control: Add Interviewer] -> Interviewer is added to the list and form closes

What it reaches:
- server-action POST createInterviewer supabase .from("interviewers").insert(): Inserts a new interviewer record into Supabase interviewers table

Fields and rules:
- name (required): String, non-empty
- email (required): Valid email format
- timezone: String, defaults to Asia/Kolkata
- working_hours_start: Number between 0 and 23, defaults to 9
- working_hours_end: Number between 1 and 24, defaults to 18

Result: Creates a new interviewer record in the database, hides the form, and refreshes the page.

Watch out:
- Email must be valid; start/end hours must be within valid range.

## Delete interviewer

_Deletes an interviewer from the recruiting team._

Feature: Delete interviewer
Page: /dashboard/settings
Deletes an interviewer from the recruiting team.

Use it when the person says things like:
- delete interviewer
- remove interviewer

Requires:
- An interviewer must exist in the list

Steps:
1. Click the trash icon button on an interviewer row [control: Delete interviewer] -> Confirmation dialog appears. Click OK to confirm deletion. Page refreshes.

What it reaches:
- server-action DELETE deleteInterviewer supabase .from("interviewers").delete(): Deletes an interviewer record from Supabase interviewers table

Fields and rules:
- id (required): Interviewer UUID

Result: Deletes the interviewer from the database and refreshes the page.

Watch out:
- Cannot be undone. Interviewer is removed from any jobs using them as default.

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Connect Calendar

_Connects a Google Calendar account for a specific interviewer to enable scheduling._

Feature: Connect Calendar
Page: /dashboard/settings
Connects a Google Calendar account for a specific interviewer to enable scheduling.

Use it when the person says things like:
- connect calendar
- link google calendar for interviewer
- sync interviewer calendar

Requires:
- An interviewer must be added in the list

Steps:
1. Click Connect Calendar on an interviewer row [control: Connect Calendar] -> Browser redirects to Google OAuth consent screen to connect calendar

What it reaches:
- other GET window.location.href ${BACKEND_URL}/api/auth/google/start?interviewer_id=${interviewerId}: Navigates to backend OAuth start endpoint for interviewer Google Calendar sync

Fields and rules:
- interviewer_id (required): Valid interviewer UUID

Result: Redirects the browser to Google OAuth consent screen for the specific interviewer, then back to the app with calendar_connected=1.

Watch out:
- Requires backend service running and valid Google OAuth credentials.

## Add a candidate and trigger AI screening call

_Manually add a candidate to the hiring pipeline and initiate an AI screening call._

Workflow: Add a candidate and trigger AI screening call
Manually add a candidate to the hiring pipeline and initiate an AI screening call.

Steps:
1. [/] Navigate to Dashboard [control: Go to dashboard > Dashboard > a-72]
2. [/dashboard/candidates/new] Add a new candidate [control: name > phone > email > job_id > Add Candidate]
3. [/dashboard/candidates/[id]] Trigger AI Screening Call [control: start-ai-call]

## Create a job posting and view candidate pipeline

_Create a new job position and inspect its details and candidate pipeline._

Workflow: Create a job posting and view candidate pipeline
Create a new job position and inspect its details and candidate pipeline.

Steps:
1. [/] Navigate to Dashboard [control: Go to dashboard > Dashboard > a-72]
2. [/dashboard/jobs] Create a new job [control: Create Job]
3. [/dashboard/jobs/new] Create a new job posting [control: title > department > location > work_model > role_type > required_skills > salary_min > s...]
4. [/dashboard/jobs] View job details and candidate pipeline [control: a-125]

## Reject a candidate and send result email

_Reject a candidate from the dashboard and send a result/rejection email._

Workflow: Reject a candidate and send result email
Reject a candidate from the dashboard and send a result/rejection email.

Steps:
1. [/] Navigate to Dashboard [control: Go to dashboard > Dashboard > a-72]
2. [/dashboard] Reject a candidate [control: reject-candidate > confirm-reject-candidate]
3. [/dashboard/candidates/[id]] Send Result Email [control: send-result-email > Send Email]

Changes data or contacts someone: tell the person exactly what you are about to do and get a yes in chat before the final press.

## Complete an interview and submit feedback

_Mark a scheduled interview as completed and submit evaluation feedback._

Workflow: Complete an interview and submit feedback
Mark a scheduled interview as completed and submit evaluation feedback.

Steps:
1. [/dashboard] Navigate to Dashboard [control: Go to dashboard > Dashboard > a-72]
2. [/dashboard/interviews] Mark an interview as completed [control: Mark Complete > Click OK on the confirmation dialog.]
3. [/dashboard/interviews] Submit interview feedback [control: Submit Feedback > Select ratings for Technical Skills, Communication, Culture Fit, and Ov...]

## Moving around the app

_Where each of the 13 pages is and what it is for._

Use the app's own navigation to change page instead of guessing addresses.
- /dashboard: Shows a recruiter dashboard with a morning update briefing, live metric counters, today's scheduled interviews with action buttons, and queues for pending tasks like shortlisting…
- /dashboard/analytics: This page displays hiring pipeline metrics, conversion rates, and AI call performance analytics.
- /dashboard/calls: Shows Neha's voice call system activity, including live calls, upcoming scheduled calls, completed calls today, and historical call logs across tabs.
- /dashboard/calls/[id]: This page displays the detailed view of a specific candidate call, including its status, duration, recording audio player, transcript, AI summary, and extracted data.
- /dashboard/candidates: View, search, and filter candidates across different hiring pipeline stages and jobs.
- /dashboard/candidates/[id]: Shows a candidate's detailed profile, score breakdown, hiring stage progress, and timeline of calls and interviews.
- /dashboard/candidates/new: This page provides a form to add a new candidate to the pipeline by entering their full name, phone number, email, and optionally associating them with an open job.
- /dashboard/helpdesk: This page displays employee support tickets grouped into Open (or escalated) and Resolved sections, showing each ticket's employee name, category bucket, status badge, query text…
- /dashboard/interviews: Shows scheduled, completed, and cancelled candidate interviews grouped by time period (Today, This Week, Later, Action needed, and Past), with job filters and quick action buttons…
- /dashboard/jobs: Lists open, paused, and closed job postings with candidate counts and pipeline stage breakdowns.
- /dashboard/jobs/[id]: Displays details for a specific job including its role type, salary range, required skills, interview rounds, default interviewer, and candidate pipeline grouped by stages.
- /dashboard/jobs/new: This page provides a form to create a new job posting, including details like title, department, location, work model, salary range, interview defaults, and description.
- /dashboard/settings: Shows account profile info, HR sender configuration, recruiting team interviewers, and system integrations status.

## Buttons that change things or contact people: ask before you press

_Delete, reject, cancel, send, email, call and similar controls change real data or reach a real person, so confirm with the person in chat first._

Never press one of these on your own initiative. Say which item and which action you are about to take, ask "Shall I go ahead?" in plain words, and act only after the person says yes in this conversation.
Reading, searching, filtering, opening things, navigating and filling a form are safe to do straight away. When a request mixes safe and risky steps, do the safe ones first and ask before the risky one.
Controls of this kind in this app:
- start-ai-call (/dashboard): Starts an AI call with the candidate.
- Cancel Meeting (/dashboard): Cancels the scheduled interview meeting.
- send-result-email (/dashboard): Sends a result email to the candidate.
- Reject (/dashboard/candidates/[id]): Rejects the candidate for the role.
- Disconnect HR sender (/dashboard/settings): Disconnects the currently connected HR sender email account.

## Recruiter Dashboard

_Shows a recruiter dashboard with a morning update briefing, live metric counters, today's scheduled interviews with action buttons, and queues for pending tasks like shortlisting…_

Page: /dashboard
What it is for: Shows a recruiter dashboard with a morning update briefing, live metric counters, today's scheduled interviews with action buttons, and queues for pending tasks like shortlisting candidates and sending offers.
Use it when: Use this page to check today's interview agenda, view urgent recruitment tasks, and take action on candidates awaiting review.
Controls on this page:
- Join: Navigates to the candidates list with the screening filter applied.
- View all: Navigates to the action tab in the candidates list to view candidates ready for shortlist or offer.
- start-ai-call: Starts an AI call with the candidate. (changes something or contacts someone: ask before pressing)
- Submit Feedback: Submits the interview feedback form.
- Cancel Meeting: Cancels the scheduled interview meeting. (changes something or contacts someone: ask before pressing)
- send-result-email: Sends a result email to the candidate. (changes something or contacts someone: ask before pressing)
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Analytics Dashboard

_This page displays hiring pipeline metrics, conversion rates, and AI call performance analytics._

Page: /dashboard/analytics
What it is for: This page displays hiring pipeline metrics, conversion rates, and AI call performance analytics.
Use it when: View hiring funnel progression, candidate conversion metrics, screening score distributions, and AI call performance stats.
Controls on this page:
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Calls Dashboard

_Shows Neha's voice call system activity, including live calls, upcoming scheduled calls, completed calls today, and historical call logs across tabs._

Page: /dashboard/calls
What it is for: Shows Neha's voice call system activity, including live calls, upcoming scheduled calls, completed calls today, and historical call logs across tabs.
Use it when: View live calls, monitor today's call statistics, and review upcoming or past candidate voice calls.
Controls on this page:
- call with m s elapsed: Opens the detail view for a specific live call.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Call Detail

_This page displays the detailed view of a specific candidate call, including its status, duration, recording audio player, transcript, AI summary, and extracted data._

Page: /dashboard/calls/[id]
What it is for: This page displays the detailed view of a specific candidate call, including its status, duration, recording audio player, transcript, AI summary, and extracted data.
Use it when: Use this page to review a specific call's recording, transcript, AI-generated summary, and extracted data for a candidate.
Controls on this page:
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Candidates Pipeline

_View, search, and filter candidates across different hiring pipeline stages and jobs._

Page: /dashboard/candidates
What it is for: View, search, and filter candidates across different hiring pipeline stages and jobs.
Use it when: Use this page to manage the candidate pipeline, search for specific candidates, or filter by job and pipeline stage.
Controls on this page:
- Add Candidate: Navigates to the Add Candidate form at /dashboard/candidates/new.
- Clear: Clears the current search query filter.
- All Jobs: Removes the job filter to show candidates across all open jobs.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Candidate Details

_Shows a candidate's detailed profile, score breakdown, hiring stage progress, and timeline of calls and interviews._

Page: /dashboard/candidates/[id]
What it is for: Shows a candidate's detailed profile, score breakdown, hiring stage progress, and timeline of calls and interviews.
Use it when: Reviewing an individual candidate's application details, AI screening scores, interview status, and advancing or rejecting them in the hiring pipeline.
Controls on this page:
- start-ai-call: Triggers a screening call to the candidate. (changes something or contacts someone: ask before pressing)
- Submit Feedback: Submits feedback for an interview round.
- Cancel Meeting: Cancels the scheduled interview meeting. (changes something or contacts someone: ask before pressing)
- send-result-email: Opens or initiates an email sending action.
- Reject: Rejects the candidate for the role. (changes something or contacts someone: ask before pressing)
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Add Candidate

_This page provides a form to add a new candidate to the pipeline by entering their full name, phone number, email, and optionally associating them with an open job._

Page: /dashboard/candidates/new
What it is for: This page provides a form to add a new candidate to the pipeline by entering their full name, phone number, email, and optionally associating them with an open job.
Use it when: Use this page when you want to manually register a new candidate into the hiring pipeline.
Controls on this page:
- Add Candidate: Saves the new candidate with the entered full name, phone number, email, and selected open job, then redirects to the candidates list.
- Cancel: Discards the form and returns to the candidates list page.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Helpdesk

_This page displays employee support tickets grouped into Open (or escalated) and Resolved sections, showing each ticket's employee name, category bucket, status badge, query text…_

Page: /dashboard/helpdesk
What it is for: This page displays employee support tickets grouped into Open (or escalated) and Resolved sections, showing each ticket's employee name, category bucket, status badge, query text snippet, and creation date.
Use it when: View and monitor employee support tickets and their statuses.
Controls on this page:
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Interviews

_Shows scheduled, completed, and cancelled candidate interviews grouped by time period (Today, This Week, Later, Action needed, and Past), with job filters and quick action buttons…_

Page: /dashboard/interviews
What it is for: Shows scheduled, completed, and cancelled candidate interviews grouped by time period (Today, This Week, Later, Action needed, and Past), with job filters and quick action buttons for meetings, feedback, and reminders.
Use it when: View your upcoming interview schedule, submit interview feedback, or manage pending candidate interview actions.
Controls on this page:
- Join: Joins the video meeting link for the scheduled interview in a new tab.
- Submit Feedback: Opens a form to submit interview feedback and recommendation.
- Cancel Meeting: Opens a dialog or triggers cancellation for the interview meeting.
- send-result-email: Sends the interview result email to the candidate. (changes something or contacts someone: ask before pressing)
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Jobs

_Lists open, paused, and closed job postings with candidate counts and pipeline stage breakdowns._

Page: /dashboard/jobs
What it is for: Lists open, paused, and closed job postings with candidate counts and pipeline stage breakdowns.
Use it when: Use this page to view existing job postings, check candidate counts across recruitment pipeline stages, or create a new job.
Controls on this page:
- Create Job: Navigates to the job creation form at /dashboard/jobs/new.
- a-125: Navigates to the detail page for the selected job.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Job Details

_Displays details for a specific job including its role type, salary range, required skills, interview rounds, default interviewer, and candidate pipeline grouped by stages._

Page: /dashboard/jobs/[id]
What it is for: Displays details for a specific job including its role type, salary range, required skills, interview rounds, default interviewer, and candidate pipeline grouped by stages.
Use it when: View job details and manage candidates in the pipeline for this position.
Controls on this page:
- All: Shows all candidates for this job in a list.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Create Job

_This page provides a form to create a new job posting, including details like title, department, location, work model, salary range, interview defaults, and description._

Page: /dashboard/jobs/new
What it is for: This page provides a form to create a new job posting, including details like title, department, location, work model, salary range, interview defaults, and description.
Use it when: Use this page when you want to add a new open position and configure its default interview settings.
Controls on this page:
- Create Job: Inserts a new job record with the specified details into the database and redirects to the jobs list page.
- Cancel: Discards the current form and returns to the jobs list page.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.

## Settings

_Shows account profile info, HR sender configuration, recruiting team interviewers, and system integrations status._

Page: /dashboard/settings
What it is for: Shows account profile info, HR sender configuration, recruiting team interviewers, and system integrations status.
Use it when: Use this page to manage your user profile, connect external integrations, and configure interviewers and HR sender email settings.
Controls on this page:
- Disconnect HR sender: Disconnects the currently connected HR sender email account. (changes something or contacts someone: ask before pressing)
- Connect HR Email: Connects an HR email account.
- Connect Calendar: Connects a Google Calendar account for an interviewer.
- Neha HR AI Recruiting Agent: Navigates to the home page or dashboard root.
- a-72: Navigates to the Dashboard page.
- a-112: Navigates to the Helpdesk page.
- sign-out: Signs the user out of the application via the logout server action.
