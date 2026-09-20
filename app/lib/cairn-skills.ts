import type { Skill } from "@cairnvibe/core";
import type { SkillStore } from "@cairnvibe/sdk/skill-store";

/**
 * What the Cairn assistant knows about each part of Neha: what the feature is for, the buttons and
 * fields on it, and the usual workflow. The Planner reads a matching skill before it plans, so
 * this is the assistant's playbook. Keep it in step with the app when a feature changes.
 */
const created = "2026-01-01T00:00:00.000Z";
const skill = (id: string, name: string, description: string, instructions: string): Skill => ({ id, name, description, instructions, createdAt: created });

export const SEED_SKILLS: Skill[] = [
  skill(
    "using-the-sidebar",
    "Moving around Neha (sidebar)",
    "The left sidebar links to every section: Dashboard, Candidates, Jobs, Interviews, Calls, Helpdesk, Analytics, Settings.",
    `The sidebar is on every page after login. Use it to change section instead of guessing URLs.
- Dashboard (/dashboard): today's briefing and what needs attention.
- Candidates (/dashboard/candidates): everyone in the pipeline.
- Jobs (/dashboard/jobs): open positions.
- Interviews (/dashboard/interviews): scheduled and past interviews.
- Calls (/dashboard/calls): Neha's AI phone calls.
- Helpdesk (/dashboard/helpdesk): employee support tickets.
- Analytics (/dashboard/analytics): hiring metrics.
- Settings (/dashboard/settings): profile, HR sender, interviewers, integrations.
The bottom of the sidebar shows the signed-in user and a sign-out button.`,
  ),
  skill(
    "dashboard-overview",
    "Reading the dashboard",
    "The home page: a briefing, counter cards for pending work, today's interviews and quick actions.",
    `Purpose: a snapshot of what needs a human today.
- Counter cards: Need screening, Ready to shortlist, To schedule, Today's interviews, Ready for offer, Failed calls (7 days). Clicking one jumps to that list.
- Today's Interviews: each row shows time, candidate, interviewer and a Join link for the meeting; a reminder-call button calls the candidate.
- Ready to Shortlist: candidates Neha scored highly. Shortlist moves them forward; Reject closes them out. These change data, so ask the user to click them themselves.
- Ready for Offer: candidates who passed the final round; Send Offer Email sends the offer.
- Failed Calls: calls that did not connect, with a Retry button.
- Pipeline chart: how many candidates sit in each stage (New, Screening, Screened, Shortlisted, Scheduling, Scheduled, Interviewing, Offer, Joined).
- Needs Manual Scheduling: candidates who rejected every offered slot; open them to schedule by hand.`,
  ),
  skill(
    "candidates",
    "Finding and adding candidates",
    "List, search, filter by job or stage, open a profile, and add a new candidate.",
    `Candidates page (/dashboard/candidates):
- Search box: type a name, email or phone and press Enter. Clear removes the search.
- Job tabs (All Jobs, then one tab per job) filter by role.
- Stage tabs: Action, All, New, Screening, Screened, Shortlisted, Scheduled, Interviewing, Done.
- Each row shows a score ring (Neha's screening score, blank if not screened), the name, role, latest note and the stage badge. Click a row to open the profile.
- Add Candidate (top right) opens /dashboard/candidates/new: Full Name and Phone are required; Email and Job are optional. The Add Candidate button saves and returns to the list; Cancel discards.
Candidate profile (/dashboard/candidates/[id]): score, qualification status, stage, an activity timeline, and action buttons for calling, shortlisting, scheduling and managing interviews. Deleting a candidate is permanent, so let the user press it.`,
  ),
  skill(
    "jobs",
    "Creating and managing jobs",
    "Open positions, their candidate pipeline, the default interviewer, and the Create Job form.",
    `Jobs page (/dashboard/jobs): Open Positions and Paused/Closed, with title, department, location, work model, salary range and a mini pipeline of candidate counts. Create Job opens /dashboard/jobs/new.
Create Job form: Job Title (required), Department, Location, Work Model (Office, Hybrid, Remote), Role Type, Required Skills (comma separated), Salary min and max (LPA), default interview duration in minutes, total interview rounds, and the job description. Create Job saves; Cancel returns to the list.
Job detail (/dashboard/jobs/[id]): the job's facts, the Default Interviewer picker (Neha uses that interviewer's calendar to schedule), and the candidates for this job filtered by stage.`,
  ),
  skill(
    "interviews",
    "Interviews and scheduling",
    "Interviews grouped by Today, This Week, Later, Action needed and Past, with Join, reminder and feedback actions.",
    `Interviews page (/dashboard/interviews): tabs group interviews by time; job tabs filter by role. Each row shows the candidate, job, interviewer and time.
- Join opens the video meeting in a new tab.
- Action-needed interviews offer reminder calls, feedback collection and sending the result to the candidate.
Scheduling: Neha calls the candidate, offers slots from the interviewer's Google Calendar and books the chosen one. If the candidate rejects every slot, the candidate lands in Needs Manual Scheduling on the dashboard.`,
  ),
  skill(
    "calls",
    "Neha's AI calls",
    "Live calls, upcoming reminder and result calls, and call history with transcript and summary.",
    `Calls page (/dashboard/calls): stats for today (calls, completed, average duration, completion rate, queued auto-calls), any live in-progress calls, upcoming reminder/result calls, and history. Tabs: Overview, Today, All.
Click a call to open /dashboard/calls/[id]: type, candidate, status, duration, the recording (if any), the full transcript, an AI summary and the data extracted from the conversation (location, notice period, expected CTC, work model). Use this page to check what a candidate actually said.`,
  ),
  skill(
    "helpdesk",
    "Employee helpdesk",
    "Employee support tickets, grouped into Open and Resolved.",
    `Helpdesk page (/dashboard/helpdesk): each ticket shows the employee, topic bucket, status, a preview of the question and the date. Open tickets are at the top, Resolved below.`,
  ),
  skill(
    "analytics",
    "Hiring analytics",
    "Pipeline metrics: totals, AI call stats, screening pass rate, funnel and score distribution.",
    `Analytics page (/dashboard/analytics): total candidates, AI call statistics, screening pass rate and overall conversion, a funnel of candidates per stage, stage-to-stage conversion rates, the distribution of screening scores and AI call performance. Read-only: nothing on this page changes data.`,
  ),
  skill(
    "settings",
    "Settings and integrations",
    "Profile, HR sender, interviewers and connection status for Twilio, Deepgram, Google and Supabase.",
    `Settings page (/dashboard/settings): Your Profile (name, email, role); HR Sender (the mailbox used for candidate emails); Interviewers (add, and connect each interviewer's Google Calendar so Neha can book their time); Integration status for Twilio, Deepgram, Claude, Google Calendar, Gmail and Supabase. Connecting Google opens Google's own consent screen, which the user must complete themselves.`,
  ),
];

/**
 * A skill store that needs no database (Neha runs on serverless hosting). The seeded feature skills
 * are always there; anything the assistant learns is kept in memory for the life of the server.
 */
export function createSeededSkillStore(): SkillStore {
  const byScope = new Map<string, Map<string, Skill>>();
  const scope = (id: string) => {
    let m = byScope.get(id);
    if (!m) {
      m = new Map(SEED_SKILLS.map((s) => [s.id, s]));
      byScope.set(id, m);
    }
    return m;
  };
  return {
    saveSkill(scopeId, s) {
      scope(scopeId).set(s.id, s);
    },
    listSkillSummaries(scopeId) {
      return [...scope(scopeId).values()].map(({ id, name, description, pattern }) => ({ id, name, description, pattern }));
    },
    getSkill(scopeId, id) {
      return scope(scopeId).get(id) ?? null;
    },
  };
}
