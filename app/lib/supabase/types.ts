export type CandidateStage =
  | "new"
  | "screening"
  | "screened"
  | "shortlisted"
  | "scheduling"
  | "scheduled"
  | "interviewing"
  | "offer"
  | "pre_joining"
  | "joined"
  | "rejected"
  | "withdrawn"
  | "no_show";

export type CallType =
  | "screening"
  | "scheduling"
  | "reminder_candidate"
  | "reminder_interviewer"
  | "result"
  | "pre_joining"
  | "engagement"
  | "exit"
  | "helpdesk"
  | "pulse_check";

export type CallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy";

export type InterviewStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type HelpdeskBucket =
  | "team_manager"
  | "time_attendance"
  | "payroll"
  | "hr_documentation"
  | "it_helpdesk";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  work_model: "office" | "hybrid" | "remote" | null;
  job_description: string | null;
  required_skills: string[] | null;
  role_type: "client_facing" | "team_handling" | "technical" | "other" | null;
  salary_range_min: number | null;
  salary_range_max: number | null;
  status: "open" | "paused" | "closed";
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  job_id: string | null;
  name: string;
  email: string | null;
  phone: string;
  resume_url: string | null;
  current_location: string | null;
  open_to_relocation: boolean | null;
  work_model_preference: string | null;
  employment_status: string | null;
  current_ctc: Record<string, unknown> | null;
  expected_ctc: Record<string, unknown> | null;
  notice_period_days: number | null;
  qualification_status: "pending" | "qualified" | "unqualified";
  score: number | null;
  score_breakdown: Record<string, unknown> | null;
  disqualification_reason: string | null;
  stage: CandidateStage;
  engagement_score: number | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  job?: Job;
}

export interface Call {
  id: string;
  candidate_id: string | null;
  call_type: CallType;
  twilio_call_sid: string | null;
  direction: string;
  status: CallStatus;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  ai_summary: string | null;
  extracted_data: Record<string, unknown> | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  candidate?: Candidate;
}

export interface Interview {
  id: string;
  candidate_id: string;
  job_id: string | null;
  round_number: number;
  interviewer_name: string | null;
  interviewer_email: string | null;
  interview_type: "in_person" | "video" | "phone" | null;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_link: string | null;
  location: string | null;
  status: InterviewStatus;
  feedback_status: "pending" | "requested" | "submitted" | "overdue";
  feedback: Record<string, unknown> | null;
  result: "pass" | "fail" | "hold" | "pending" | null;
  result_communicated: boolean;
  created_at: string;
  candidate?: Candidate;
  job?: Job;
}

export interface HelpdeskTicket {
  id: string;
  employee_name: string;
  employee_phone: string;
  employee_email: string | null;
  bucket: HelpdeskBucket;
  query_text: string | null;
  status: "open" | "resolved" | "escalated";
  escalated_to: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ExitInterview {
  id: string;
  employee_name: string | null;
  reason_for_leaving: string | null;
  manager_rating: number | null;
  team_rating: number | null;
  culture_rating: number | null;
  suggestions: string | null;
  tags: string[] | null;
  summary: string | null;
  created_at: string;
}
