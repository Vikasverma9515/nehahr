import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { CallTriggerButton } from "@/app/components/call-trigger-button";
import { DeleteCandidateButton } from "@/app/components/delete-candidate-button";
import {
  ShortlistButton,
  RejectButton,
  OverrideShortlistButton,
} from "@/app/components/stage-actions";
import { ScheduleInterviewButton } from "@/app/components/schedule-interview-button";
import {
  MarkCompleteButton,
  FeedbackButton,
  ReminderCallButton,
  ResultCallButton,
  CancelMeetingButton,
} from "@/app/components/interview-actions";
import { SendEmailButton } from "@/app/components/send-email-button";
import {
  Video,
  ExternalLink,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Clock,
  IndianRupee,
  Check,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/app/components/person-avatar";
import { AiInterviewCard, type AiInterviewRow } from "@/app/components/ai-interview-card";
import { NehaMeetControl } from "@/app/components/neha-meet-control";
import { MessagesCard, type MessageRow } from "@/app/components/messages-card";
import { PortalLinkButton } from "@/app/components/portal-link-button";
import { OfferCard } from "@/app/components/offer-card";
import { RescoreButton } from "@/app/components/rescore-button";
import { DocumentsCard, type DocRow } from "@/app/components/documents-card";
import { NoShowButton } from "@/app/components/no-show-button";
import { RecruiterNotes } from "@/app/components/recruiter-notes";
import type { OfferRow } from "@/app/actions/offers";
import type { NehaRole } from "@/app/actions/interviews";

const SCORING_WEIGHTS: Record<string, number> = {
  location_fit: 10,
  work_model_fit: 10,
  notice_period_fit: 15,
  ctc_alignment: 20,
  role_experience: 30,
  salary_trajectory: 15,
};

const SCORE_LABELS: Record<string, string> = {
  location_fit: "Location",
  work_model_fit: "Work Model",
  notice_period_fit: "Notice Period",
  ctc_alignment: "CTC Match",
  role_experience: "Role Exp.",
  salary_trajectory: "Salary Traj.",
};

const PROGRESS_STAGES = [
  "new", "screening", "screened", "shortlisted", "scheduled", "interviewing", "offer", "joined",
] as const;

function formatCtc(ctc: unknown): string {
  if (!ctc || typeof ctc !== "object") return "-";
  const obj = ctc as Record<string, number>;
  if (obj.min != null && obj.max != null) return `${obj.min}–${obj.max} LPA`;
  if (obj.min != null) return `${obj.min}+ LPA`;
  const parts: string[] = [];
  if (obj.fixed != null) parts.push(`${obj.fixed}L fixed`);
  if (obj.variable != null) parts.push(`${obj.variable}L variable`);
  if (parts.length > 0) return parts.join(" + ");
  return JSON.stringify(ctc);
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("*, jobs(title, department, work_model, role_type, total_interview_rounds)")
    .eq("id", id)
    .single();
  if (!candidate) notFound();

  const { data: calls } = await supabase
    .from("calls")
    .select("id, call_type, status, duration_seconds, ai_summary, extracted_data, created_at")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  const { data: interviews } = await supabase
    .from("interviews")
    .select("*, interviewers(name, email)")
    .eq("candidate_id", id)
    .order("scheduled_at", { ascending: false });

  // Table from migration 012; an older database just shows no invites.
  const { data: aiInterviews } = await supabase
    .from("ai_interviews")
    .select("id, status, expires_at, invited_at, score, summary, call_id, token")
    .eq("candidate_id", id)
    .order("invited_at", { ascending: false });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, author, channel, status, created_at")
    .eq("candidate_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  const { data: offers } = await supabase
    .from("offers")
    .select("id, status, designation, ctc, joining_date, expires_at, sent_at, responded_at, approval_required, decline_reason, signature_name, token, letter_html")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  const { data: documents } = await supabase
    .from("candidate_documents")
    .select("id, kind, file_name, status, note, uploaded_at")
    .eq("candidate_id", id)
    .order("uploaded_at", { ascending: false });

  const scoreBreakdown = candidate.score_breakdown as Record<string, number> | null;
  const job = candidate.jobs as unknown as {
    title: string;
    department: string;
    total_interview_rounds?: number;
  } | null;
  const totalRounds = job?.total_interview_rounds ?? 1;
  const score = candidate.score as number | null;
  const isQualified = candidate.qualification_status === "qualified";
  const stageIdx = PROGRESS_STAGES.indexOf(candidate.stage as (typeof PROGRESS_STAGES)[number]);

  // Derive progress from interviews, not just candidate.stage — the stage
  // column can drift (e.g. if booking raced with a cleanup write), but the
  // interviews table is authoritative for "is something actually scheduled".
  const hasActiveScheduledInterview = (interviews || []).some(
    (iv) => iv.status === "scheduled"
  );
  const hasActiveCompletedInterview = (interviews || []).some(
    (iv) => iv.status === "completed"
  );
  // HR shouldn't be asked to shortlist/reject/schedule when an interview is
  // already on the calendar or awaiting feedback — that's the source of the
  // "why is Reject showing when Round 1 is set?" confusion.
  const inInterviewFlow = hasActiveScheduledInterview || hasActiveCompletedInterview;

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-5">
          {/* Score ring */}
          {score != null ? (
            <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 68 68" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="34" cy="34" r="28" fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                />
              </svg>
              <span className="font-display text-[20px] font-bold text-dark-text">{score}</span>
            </div>
          ) : (
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-white/[0.08]">
              <span className="text-[11px] uppercase tracking-wider text-dark-text-muted">N/A</span>
            </div>
          )}
          <PersonAvatar name={candidate.name} size={64} shape="soft" />
          <div>
            <h1 className="text-[22px] font-bold text-dark-text">{candidate.name}</h1>
            <p className="mt-0.5 text-[13px] text-dark-text-muted">
              {job?.title || "No role"}{job?.department ? ` · ${job.department}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{candidate.stage}</Badge>
              {candidate.qualification_status !== "pending" && (
                <Badge>{candidate.qualification_status}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Interview state wins over stage. If an interview is on the
            calendar or awaiting feedback, show that — never show Shortlist /
            Reject / Schedule buttons in parallel with a real interview.
          */}
          {inInterviewFlow ? (
            hasActiveScheduledInterview ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text">
                <Check className="h-3.5 w-3.5" /> Interview scheduled
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text">
                <Check className="h-3.5 w-3.5" /> Interview in progress
              </span>
            )
          ) : (
            <>
              {candidate.stage === "new" && (
                <CallTriggerButton candidateId={candidate.id} callType="screening" label="Trigger Screening Call" />
              )}
              {candidate.stage === "screened" && (
                <>
                  <ShortlistButton candidateId={candidate.id} />
                  <RejectButton candidateId={candidate.id} />
                </>
              )}
              {candidate.stage === "shortlisted" && (
                <ScheduleInterviewButton candidateId={candidate.id} />
              )}
              {candidate.stage === "scheduling" && (
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-accent">
                  Neha is scheduling...
                </span>
              )}
              {candidate.stage === "scheduled" && (
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text">
                  <Check className="h-3.5 w-3.5" /> Interview scheduled
                </span>
              )}
              {candidate.stage === "rejected" && (
                <OverrideShortlistButton candidateId={candidate.id} />
              )}
            </>
          )}
          <PortalLinkButton candidateId={candidate.id} />
          <DeleteCandidateButton candidateId={candidate.id} />
        </div>
      </div>

      {/* ── Manual scheduling alert ──────────────────────────────── */}
      {candidate.needs_manual_scheduling && (
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-dark-text-secondary" />
          <div>
            <p className="text-[12px] font-semibold text-dark-text">Manual scheduling needed</p>
            <p className="mt-0.5 text-[11px] text-dark-text-muted">
              {candidate.scheduling_notes || "Neha could not confirm a slot. Please reach out manually."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stage progress ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center justify-between">
          {PROGRESS_STAGES.map((stage, i) => {
            const isCurrent = stage === candidate.stage;
            const isPast = stageIdx >= 0 && i < stageIdx;
            return (
              <div key={stage} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      isCurrent
                        ? "border-accent bg-accent/15"
                        : isPast
                          ? "border-[#7dd4a8]/30 bg-[#7dd4a8]/10"
                          : "border-white/[0.08] bg-transparent"
                    }`}
                  >
                    {isPast ? (
                      <Check className="h-3 w-3 text-[#7dd4a8]" />
                    ) : (
                      <span className={`text-[8px] font-bold ${isCurrent ? "text-accent" : "text-dark-text-muted/40"}`}>
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <span className={`text-[8px] font-medium uppercase tracking-[0.06em] ${
                    isCurrent ? "text-accent" : isPast ? "text-[#7dd4a8]/70" : "text-dark-text-muted/40"
                  }`}>
                    {stage.replace(/_/g, " ")}
                  </span>
                </div>
                {i < PROGRESS_STAGES.length - 1 && (
                  <div className={`mx-1 h-px flex-1 ${isPast ? "bg-[#7dd4a8]/20" : "bg-white/[0.04]"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      {/*
        Layout: Journey is the primary surface — it gets 2/3 width on the
        left where the timeline can breathe and action buttons don't wrap.
        Right sidebar holds compact Profile + Scorecard cards stacked.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — Journey (primary, dominant) */}
        <div className="lg:col-span-2">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-dark-text">
                Journey
              </h2>
              <span className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">
                Past activity & what&apos;s next
              </span>
            </div>
            <JourneyTimeline
              candidateId={candidate.id}
              candidateStage={candidate.stage}
              calls={calls || []}
              interviews={interviews || []}
              hrAlert={candidate.scheduling_notes || null}
              totalRounds={totalRounds}
            />
          </Card>
        </div>

        {/* Right — Profile + Scorecard sidebar (compact) */}
        <div className="space-y-6">
          {/* Profile — contact / employment / comp condensed */}
          <Card>
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-dark-text">
              Profile
            </h2>
            <div className="space-y-4">
              <SidebarSection label="Contact">
                {candidate.phone && <Row icon={Phone} text={candidate.phone} />}
                {candidate.email && <Row icon={Mail} text={candidate.email} />}
                {candidate.current_location && (
                  <Row
                    icon={MapPin}
                    text={
                      candidate.current_location +
                      (candidate.open_to_relocation ? " (open to relocation)" : "")
                    }
                  />
                )}
              </SidebarSection>

              <SidebarSection label="Employment">
                <Row icon={Briefcase} text={candidate.employment_status || "—"} capitalize />
                <Row
                  icon={Clock}
                  text={candidate.notice_period_days ? `${candidate.notice_period_days} days notice` : "Notice not set"}
                />
                {candidate.work_model_preference && (
                  <Row icon={MapPin} text={`${candidate.work_model_preference} preferred`} capitalize />
                )}
              </SidebarSection>

              {(candidate.current_ctc || candidate.expected_ctc) && (
                <SidebarSection label="Compensation">
                  <div className="grid grid-cols-2 gap-2">
                    <CompactStat label="Current" value={formatCtc(candidate.current_ctc)} />
                    <CompactStat label="Expected" value={formatCtc(candidate.expected_ctc)} />
                  </div>
                </SidebarSection>
              )}
            </div>
          </Card>

          {/* Recruiter notes */}
          <Card>
            <RecruiterNotes candidateId={candidate.id} initial={(candidate as { recruiter_notes?: string | null }).recruiter_notes ?? null} />
          </Card>

          {/* Resume match (from bulk intake) */}
          {candidate.match_score != null && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Resume match</h2>
                <span className="font-display text-[22px] text-dark-text">{candidate.match_score}%</span>
              </div>
              {candidate.match_reasons?.one_line && (
                <p className="mt-2 text-[12px] text-dark-text-secondary">{candidate.match_reasons.one_line}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="mb-1 uppercase tracking-[0.08em] text-dark-text-muted">Strengths</p>
                  {(candidate.match_reasons?.strengths || []).map((x: string) => <p key={x} className="text-dark-text-secondary">+ {x}</p>)}
                </div>
                <div>
                  <p className="mb-1 uppercase tracking-[0.08em] text-dark-text-muted">Gaps</p>
                  {(candidate.match_reasons?.gaps || []).map((x: string) => <p key={x} className="text-dark-text-secondary">– {x}</p>)}
                </div>
              </div>
            </Card>
          )}

          {/* Offer */}
          {(["interviewing", "offer", "pre_joining", "joined", "scheduled"].includes(candidate.stage) || (offers || []).length > 0) && (
            <Card>
              <OfferCard
                candidateId={candidate.id}
                offers={(offers || []) as OfferRow[]}
                defaultTitle={job?.title || ""}
                appUrl={process.env.FRONTEND_URL || ""}
              />
            </Card>
          )}

          {/* Joining documents */}
          {(["offer", "pre_joining", "joined"].includes(candidate.stage) || (documents || []).length > 0) && (
            <Card>
              <DocumentsCard candidateId={candidate.id} docs={(documents || []) as DocRow[]} />
            </Card>
          )}

          {/* WhatsApp / SMS thread */}
          <Card>
            <MessagesCard candidateId={candidate.id} messages={(messages || []) as MessageRow[]} optedOut={!!candidate.messaging_opt_out} />
          </Card>

          {/* AI video interview */}
          <Card>
            <AiInterviewCard
              candidateId={candidate.id}
              rows={(aiInterviews || []) as AiInterviewRow[]}
              appUrl={process.env.FRONTEND_URL || ""}
            />
          </Card>

          {/* Scorecard — compact, only if scored */}
          {score != null && scoreBreakdown && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-dark-text">
                  Scorecard <RescoreButton candidateId={candidate.id} />
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    isQualified
                      ? "bg-[#7dd4a8]/10 text-[#7dd4a8]"
                      : "bg-[#e8908a]/10 text-[#e8908a]"
                  }`}
                >
                  {isQualified ? "Qualified" : "Not Qualified"}
                </span>
              </div>

              {candidate.disqualification_reason && (
                <p className="mb-4 rounded-lg bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-dark-text-muted">
                  {candidate.disqualification_reason}
                </p>
              )}

              <div className="space-y-2">
                {Object.entries(scoreBreakdown).map(([key, value]) => {
                  const weight = SCORING_WEIGHTS[key] || 0;
                  const label = SCORE_LABELS[key] || key.replace(/_/g, " ");
                  return (
                    <div key={key}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] text-dark-text-secondary">{label}</span>
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className={`text-[12px] font-semibold ${
                              value >= 80
                                ? "text-[#7dd4a8]"
                                : value >= 60
                                  ? "text-dark-text"
                                  : "text-[#d4c27d]"
                            }`}
                          >
                            {value}
                          </span>
                          <span className="text-[9px] uppercase tracking-[0.08em] text-dark-text-muted">
                            {weight}%
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-white/[0.04]">
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${value}%`,
                            background:
                              value >= 80
                                ? "rgba(125,212,168,0.6)"
                                : value >= 60
                                  ? "rgba(139,92,246,0.5)"
                                  : "rgba(212,194,125,0.6)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-dark-text-muted">
                Threshold: overall &ge; 60 AND role experience &ge; 50.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-secondary">
        {label}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-dark-text-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-0.5 text-[12px] font-semibold text-dark-text">
        <IndianRupee className="h-3 w-3 text-dark-text-muted" />
        {value}
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  text,
  capitalize: cap,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-dark-text-muted" />
      <span className={`text-[13px] text-dark-text ${cap ? "capitalize" : ""}`}>{text}</span>
    </div>
  );
}

// ── Journey Timeline ────────────────────────────────────────────────

type TimelineEvent = {
  id: string;
  time: Date;
  type: "call" | "stage" | "interview" | "auto" | "action";
  done: boolean;
  title: string;
  subtitle?: string;
  tag?: string;
  callId?: string;
  interviewId?: string;
  action?: React.ReactNode;
  retryCallType?: string;
  // Outcome tone — renders subtitle as a colored pill so HR can scan the
  // timeline and see good/bad outcomes at a glance.
  outcomeTone?: "positive" | "negative" | "warning";
  // Extra content rendered below the event (e.g., interviewer feedback card)
  extraContent?: React.ReactNode;
};

type InterviewFeedback = {
  technical_skills?: number;
  communication?: number;
  culture_fit?: number;
  overall?: number;
  recommendation?: string;
  strengths?: string;
  concerns?: string;
  notes?: string;
  result?: string;
};

function JourneyTimeline({
  candidateId,
  candidateStage,
  calls,
  interviews,
  hrAlert,
  totalRounds,
}: {
  candidateId: string;
  candidateStage: string;
  calls: any[];
  interviews: any[];
  hrAlert: string | null;
  totalRounds: number;
}) {
  const events: TimelineEvent[] = [];
  const now = new Date();

  // ── 1. Past calls (always show — these are facts) ──────────────
  for (const call of calls) {
    const callTime = new Date(call.created_at);
    const isFailed = call.status === "failed" || call.status === "no_answer" || call.status === "busy";
    const isInProgress = call.status === "in_progress" || call.status === "ringing" || call.status === "queued";

    // Pull typed outcome hints out of extracted_data so the subtitle can
    // say *what happened*, not just "Reminder delivered" for every call.
    const extracted = (call.extracted_data || {}) as Record<string, unknown>;

    let subtitle = "";
    let outcomeTone: "positive" | "negative" | "warning" | undefined;
    if (call.status === "completed") {
      if (call.call_type === "screening" && call.ai_summary) {
        subtitle = call.ai_summary;
      } else if (call.call_type === "scheduling") {
        if (extracted.confirmed_slot_id != null) {
          subtitle = "Candidate confirmed a slot";
          outcomeTone = "positive";
        } else if (extracted.manual_scheduling_needed) {
          subtitle = "No slot worked — flagged for manual";
          outcomeTone = "warning";
        } else {
          subtitle = "Interview slot negotiated";
        }
      } else if (call.call_type === "reminder") {
        if (extracted.candidate_dropping) {
          subtitle = "Candidate said they can't make it — interview cancelled";
          outcomeTone = "negative";
        } else {
          subtitle = "Candidate confirmed attendance";
          outcomeTone = "positive";
        }
      } else if (call.call_type === "result") {
        subtitle = "Result communicated";
        outcomeTone = "positive";
      } else if (call.ai_summary) {
        subtitle = call.ai_summary;
      }
    } else if (isFailed) {
      subtitle = call.status === "no_answer"
        ? "Candidate did not pick up"
        : call.status === "busy"
          ? "Candidate's line was busy"
          : "Call failed — could not connect";
      outcomeTone = "negative";
    } else if (isInProgress) {
      subtitle = "Call in progress...";
    }

    const duration = call.duration_seconds
      ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
      : undefined;

    events.push({
      id: `call-${call.id}`,
      time: callTime,
      type: isFailed ? "action" : "call",
      done: call.status === "completed" || isFailed,
      title: isFailed
        ? `${call.call_type.replace(/_/g, " ")} call — ${call.status.replace(/_/g, " ")}`
        : `${call.call_type.replace(/_/g, " ")} call`,
      subtitle,
      outcomeTone,
      tag: isFailed ? call.status.replace(/_/g, " ") : duration,
      callId: call.id,
      // For failed calls, store the call_type so TimelineItem can render a retry button
      retryCallType: isFailed ? call.call_type : undefined,
    });
  }

  // ── 2. Interviews (past = done, future = only for active interviews) ─
  // Find the LATEST non-cancelled interview — that's the "active" one
  const activeInterview = interviews.find((iv) => iv.status === "scheduled" || iv.status === "completed");

  for (const iv of interviews) {
    const interviewer = iv.interviewers as { name: string } | null;
    const ivTime = iv.scheduled_at ? new Date(iv.scheduled_at) : new Date(iv.created_at);
    const isScheduled = iv.status === "scheduled";
    const isCompleted = iv.status === "completed";
    const isCancelled = iv.status === "cancelled";
    const needsFeedback = isCompleted && iv.feedback_status !== "submitted";
    const feedbackDone = iv.feedback_status === "submitted";
    const isActive = activeInterview?.id === iv.id;

    let subtitle = `${(iv.interview_type || "video").replace(/_/g, " ")} · ${iv.duration_minutes || 60} min`;
    if (interviewer) subtitle += ` · ${interviewer.name}`;

    // Build a richer result line including the interviewer's recommendation.
    // feedback is stored as JSON ({ ratings, recommendation, strengths, ... })
    const feedback = (iv.feedback || null) as InterviewFeedback | null;
    const prettyRec = feedback?.recommendation
      ? feedback.recommendation.replace(/_/g, " ")
      : null;

    let resultLine = "";
    let ivOutcomeTone: "positive" | "negative" | "warning" | undefined;
    if (iv.result) {
      const resultLabel = iv.result.charAt(0).toUpperCase() + iv.result.slice(1);
      resultLine = prettyRec
        ? `${resultLabel} · interviewer: ${prettyRec}`
        : `Result: ${iv.result}`;
      if (iv.result_communicated) resultLine += " · communicated";
      ivOutcomeTone =
        iv.result === "pass" ? "positive"
        : iv.result === "fail" ? "negative"
        : "warning";
    }

    // The interview event itself (always show)
    events.push({
      id: `iv-${iv.id}`,
      time: ivTime,
      type: "interview",
      done: isCompleted || isCancelled,
      title: isCancelled
        ? `Round ${iv.round_number} — Cancelled`
        : isCompleted
          ? `Round ${iv.round_number} — Completed`
          : `Round ${iv.round_number} — Interview`,
      subtitle: resultLine || subtitle,
      outcomeTone: ivOutcomeTone,
      interviewId: iv.id,
      // If feedback was submitted, render it inline so HR can see it
      // without opening a modal — especially important before they decide
      // on the next round.
      extraContent: feedbackDone && feedback ? <FeedbackCard feedback={feedback} />
        : iv.ai_notes?.summary ? (
          <div className="mt-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-dark-text-secondary">
            <span className="font-semibold text-dark-text">Neha&apos;s notes: </span>{iv.ai_notes.summary}
          </div>
        ) : undefined,
      // Only show action buttons for the ACTIVE interview (not cancelled ones)
      action: isActive ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isScheduled && iv.meeting_link && (
            <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-[#7dd4a8]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#7dd4a8] hover:bg-[#7dd4a8]/20">
              <Video className="h-3 w-3" /> Join Meet <ExternalLink className="h-2 w-2" />
            </a>
          )}
          {isScheduled && <MarkCompleteButton interviewId={iv.id} />}
          {isScheduled && ivTime.getTime() <= now.getTime() + 30 * 60_000 && <NoShowButton interviewId={iv.id} />}
          {needsFeedback && <FeedbackButton interviewId={iv.id} />}
          {isScheduled && !iv.candidate_reminded && (
            <ReminderCallButton candidateId={candidateId} />
          )}
          {isScheduled && <CancelMeetingButton interviewId={iv.id} />}
          {isScheduled && iv.meeting_link?.includes("meet.google.com") && (
            <NehaMeetControl
              interviewId={iv.id}
              candidateId={candidateId}
              role={(iv.neha_role || "none") as NehaRole}
              botStatus={iv.bot_status || null}
            />
          )}
        </div>
      ) : undefined,
    });

    // ── Future auto-events ONLY for the active scheduled interview ──
    if (!isActive || isCancelled) continue;

    if (isScheduled && !iv.candidate_reminded && ivTime > now) {
      events.push({
        id: `auto-reminder-${iv.id}`,
        time: new Date(ivTime.getTime() - 2 * 60 * 60 * 1000),
        type: "auto",
        done: false,
        title: "Reminder call",
        subtitle: "Neha will auto-call 2 hours before the interview",
        tag: "auto",
        action: <ReminderCallButton candidateId={candidateId} />,
      });
    }

    if (isScheduled && iv.candidate_reminded) {
      events.push({
        id: `auto-reminder-done-${iv.id}`,
        time: new Date(ivTime.getTime() - 2 * 60 * 60 * 1000),
        type: "auto", done: true,
        title: "Reminder call",
        subtitle: "Candidate confirmed attendance",
        tag: "done",
      });
    }

    if (isScheduled) {
      events.push({
        id: `auto-feedback-${iv.id}`,
        time: new Date(ivTime.getTime() + (iv.duration_minutes || 60) * 60 * 1000),
        type: "auto", done: false,
        title: "Feedback form sent to interviewer",
        subtitle: "Auto-dispatched after interview ends",
        tag: "auto",
      });
    }

    if (needsFeedback) {
      events.push({
        id: `action-feedback-${iv.id}`,
        time: new Date(ivTime.getTime() + 1000),
        type: "action", done: false,
        title: "Submit interviewer feedback",
        subtitle: "Rate the candidate and set the result (pass / fail / hold)",
        action: <FeedbackButton interviewId={iv.id} />,
      });
    }

    // Result handling — HR is always in the loop. A passed round doesn't
    // auto-advance; HR reviews feedback and clicks Schedule Round N+1 (or
    // Reject) themselves.
    const isFinalRound = (iv.round_number || 1) >= totalRounds;
    const hasNextRoundAlready = interviews.some(
      (other: any) =>
        (other.round_number || 1) > (iv.round_number || 1) &&
        other.status !== "cancelled"
    );

    if (feedbackDone && iv.result === "pass" && !isFinalRound && !hasNextRoundAlready) {
      // Mid-process pass — HR decides whether to advance
      const nextRound = (iv.round_number || 1) + 1;
      events.push({
        id: `hr-advance-${iv.id}`,
        time: new Date(),
        type: "action",
        done: false,
        title: `Round ${iv.round_number} passed — schedule Round ${nextRound}?`,
        subtitle: "Review the interviewer's feedback, then schedule the next round or reject.",
        action: (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScheduleInterviewButton candidateId={candidateId} />
            <RejectButton candidateId={candidateId} />
          </div>
        ),
      });
    }

    if (feedbackDone && iv.result === "pass" && isFinalRound && !iv.result_communicated) {
      // Final-round pass — HR has the final call. Interviewer recommended
      // pass, but HR can still choose to Offer, Hold, or Reject. Mirrors how
      // real HR tools surface an explicit decision at the end.
      events.push({
        id: `hr-offer-${iv.id}`,
        time: new Date(),
        type: "action",
        done: false,
        title: "HR decision needed",
        subtitle:
          "Interviewer recommended Pass. Review the feedback, then choose: extend an offer, put on hold, or reject.",
        action: (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SendEmailButton
              interviewId={iv.id}
              result="pass"
              overrideAs="pass"
              label="Make Offer"
              tone="positive"
            />
            <SendEmailButton
              interviewId={iv.id}
              result="pass"
              overrideAs="hold"
              label="Put on Hold"
              tone="warning"
            />
            <SendEmailButton
              interviewId={iv.id}
              result="pass"
              overrideAs="fail"
              label="Reject"
              tone="negative"
            />
          </div>
        ),
      });
    }
    if (feedbackDone && iv.result === "fail" && !iv.result_communicated) {
      events.push({
        id: `hr-reject-email-${iv.id}`,
        time: new Date(), type: "action", done: false,
        title: "Send rejection email",
        subtitle: "Interview did not pass — send a polite rejection to the candidate",
        action: <SendEmailButton interviewId={iv.id} result="fail" />,
      });
    }
    if (feedbackDone && iv.result === "hold" && !iv.result_communicated) {
      events.push({
        id: `hr-hold-email-${iv.id}`,
        time: new Date(), type: "action", done: false,
        title: "Send status update",
        subtitle: "Decision pending — optionally send a hold update to the candidate",
        action: <SendEmailButton interviewId={iv.id} result="hold" />,
      });
    }
    if (iv.result_communicated) {
      events.push({
        id: `auto-result-done-${iv.id}`,
        time: iv.result_communicated_at ? new Date(iv.result_communicated_at) : ivTime,
        type: "auto", done: true,
        title: "Result communicated",
        subtitle: `Candidate informed of ${iv.result} result`,
      });
    }
  }

  // ── 3. What's next? — ONLY if no active interview is handling it ──
  // These guide HR on what to do, but ONLY show if the candidate is
  // actually in that stage right now. No stale hints.
  const hasActiveScheduled = interviews.some((iv) => iv.status === "scheduled");
  const hasActiveCompleted = interviews.some((iv) => iv.status === "completed" && iv.feedback_status !== "submitted");

  if (candidateStage === "new") {
    events.push({
      id: "next-screening", time: now, type: "action", done: false,
      title: "Trigger screening call",
      subtitle: "Candidate is new — needs initial screening",
    });
  }
  // Only show shortlist hint if actually screened AND no interview is in progress
  if (candidateStage === "screened" && !hasActiveScheduled && !hasActiveCompleted) {
    events.push({
      id: "next-shortlist", time: now, type: "action", done: false,
      title: "Shortlist decision needed",
      subtitle: "Review score and decide",
    });
  }
  // Only show schedule hint if shortlisted AND no interview exists yet
  if (candidateStage === "shortlisted" && !hasActiveScheduled) {
    events.push({
      id: "next-schedule", time: now, type: "action", done: false,
      title: "Schedule interview",
      subtitle: "Candidate is shortlisted — trigger scheduling call",
    });
  }

  // Sort: done events by time ascending, then future events by time ascending
  events.sort((a, b) => {
    // Done events first (ascending), then future (ascending)
    if (a.done && !b.done) return -1;
    if (!a.done && b.done) return 1;
    return a.time.getTime() - b.time.getTime();
  });

  // Split into past and upcoming
  const past = events.filter((e) => e.done);
  const upcoming = events.filter((e) => !e.done);

  if (events.length === 0) {
    return <p className="py-4 text-center text-[13px] text-dark-text-muted">No activity yet</p>;
  }

  return (
    <div className="relative">
      {/* HR Alert — shown when AI flags something for HR attention */}
      {hrAlert && (
        <div className="mb-4 rounded-xl border border-[#d4c27d]/20 bg-[#d4c27d]/[0.05] px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-[#d4c27d]">Needs HR attention</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-dark-text-secondary">{hrAlert}</p>
        </div>
      )}
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />

      <div className="space-y-0">
        {/* Past events */}
        {past.map((ev) => (
          <TimelineItem key={ev.id} event={ev} candidateId={candidateId} />
        ))}

        {/* Separator between past and future */}
        {past.length > 0 && upcoming.length > 0 && (
          <div className="relative z-10 my-4 flex items-center gap-2 pl-5">
            <div className="h-px flex-1 bg-white/[0.1]" />
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-dark-text-secondary">
              Coming up
            </span>
            <div className="h-px flex-1 bg-white/[0.1]" />
          </div>
        )}

        {/* Future events */}
        {upcoming.map((ev) => (
          <TimelineItem key={ev.id} event={ev} candidateId={candidateId} />
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: InterviewFeedback }) {
  // Compact inline view of the interviewer's structured feedback. Shows
  // ratings as tiny bars, strengths/concerns as labelled blocks, and the
  // recommendation as a colored pill. Designed to fit inside the journey
  // timeline without dominating it.
  const RATING_FIELDS: { key: keyof InterviewFeedback; label: string }[] = [
    { key: "technical_skills", label: "Technical" },
    { key: "communication", label: "Communication" },
    { key: "culture_fit", label: "Culture Fit" },
    { key: "overall", label: "Overall" },
  ];

  const recTone: "positive" | "negative" | "warning" =
    feedback.recommendation === "strong_yes" || feedback.recommendation === "yes"
      ? "positive"
      : feedback.recommendation === "strong_no" || feedback.recommendation === "no"
        ? "negative"
        : "warning";
  const recColors = {
    positive: "bg-[#7dd4a8]/10 text-[#7dd4a8] ring-[#7dd4a8]/20",
    warning: "bg-[#d4c27d]/10 text-[#d4c27d] ring-[#d4c27d]/20",
    negative: "bg-[#e89090]/10 text-[#e89090] ring-[#e89090]/20",
  }[recTone];

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      {/* Header row — recommendation */}
      {feedback.recommendation && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">
            Interviewer&apos;s Feedback
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${recColors}`}
          >
            {feedback.recommendation.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {/* Ratings — compact 4-col grid */}
      <div className="grid grid-cols-4 gap-2">
        {RATING_FIELDS.map(({ key, label }) => {
          const val = (feedback[key] as number | undefined) || 0;
          const pct = (val / 5) * 100;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-dark-text-muted">{label}</span>
                <span className="text-[11px] font-semibold text-dark-text">{val}/5</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/[0.04]">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background:
                      val >= 4
                        ? "rgba(125,212,168,0.6)"
                        : val >= 3
                          ? "rgba(139,92,246,0.5)"
                          : "rgba(212,194,125,0.6)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Strengths / Concerns / Notes */}
      {(feedback.strengths || feedback.concerns || feedback.notes) && (
        <div className="mt-4 space-y-2.5">
          {feedback.strengths && (
            <FeedbackBlock label="Strengths" text={feedback.strengths} tone="positive" />
          )}
          {feedback.concerns && (
            <FeedbackBlock label="Concerns" text={feedback.concerns} tone="warning" />
          )}
          {feedback.notes && (
            <FeedbackBlock label="Notes" text={feedback.notes} />
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackBlock({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone?: "positive" | "warning";
}) {
  const accent =
    tone === "positive"
      ? "text-[#7dd4a8]"
      : tone === "warning"
        ? "text-[#d4c27d]"
        : "text-dark-text-muted";
  return (
    <div>
      <p className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${accent}`}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-dark-text-secondary">{text}</p>
    </div>
  );
}

function OutcomePill({
  tone,
  text,
}: {
  tone: "positive" | "negative" | "warning";
  text: string;
}) {
  // Semantic colors that scan at a glance: green = good, amber = needs
  // attention, red = something went wrong. Inline-flex keeps it tight next to
  // the title row without hogging width.
  const styles = {
    positive: {
      wrap: "bg-[#7dd4a8]/10 text-[#7dd4a8] ring-1 ring-[#7dd4a8]/20",
      dot: "bg-[#7dd4a8]",
    },
    warning: {
      wrap: "bg-[#d4c27d]/10 text-[#d4c27d] ring-1 ring-[#d4c27d]/20",
      dot: "bg-[#d4c27d]",
    },
    negative: {
      wrap: "bg-[#e89090]/10 text-[#e89090] ring-1 ring-[#e89090]/20",
      dot: "bg-[#e89090]",
    },
  }[tone];

  return (
    <span
      className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight ${styles.wrap}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
      <span className="truncate">{text}</span>
    </span>
  );
}

function TimelineItem({ event: ev, candidateId }: { event: TimelineEvent; candidateId: string }) {
  const timeStr = ev.time.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const clockStr = ev.time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const content = (
    <div className="flex gap-3 py-2.5 pl-0">
      {/* Dot */}
      <div className="relative z-10 mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center">
        {ev.done ? (
          <div className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#7dd4a8]/15">
            <Check className="h-2.5 w-2.5 text-[#7dd4a8]" />
          </div>
        ) : ev.type === "action" ? (
          <div className="h-3 w-3 rounded-full border-2 border-[#d4c27d] bg-[#d4c27d]/20" />
        ) : ev.type === "auto" ? (
          <div className="h-3 w-3 rounded-full border-2 border-[#8ab4d9]/50 bg-[#8ab4d9]/10" />
        ) : ev.type === "interview" ? (
          <div className="h-3 w-3 rounded-full border-2 border-[#b4a0e8]/50 bg-[#b4a0e8]/10" />
        ) : (
          <div className="h-3 w-3 rounded-full border-2 border-white/[0.2] bg-white/[0.05]" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-semibold capitalize ${ev.done ? "text-dark-text-secondary" : "text-dark-text"}`}>
            {ev.title}
          </span>
          {ev.tag && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              ev.tag === "auto"
                ? "bg-[#8ab4d9]/10 text-[#8ab4d9]"
                : ev.tag === "queued"
                  ? "bg-[#d4c27d]/10 text-[#d4c27d]"
                  : ev.tag === "done"
                    ? "bg-[#7dd4a8]/10 text-[#7dd4a8]"
                    : "bg-white/[0.06] text-dark-text-muted"
            }`}>
              {ev.tag}
            </span>
          )}
        </div>
        {ev.subtitle && (
          ev.outcomeTone ? (
            <OutcomePill tone={ev.outcomeTone} text={ev.subtitle} />
          ) : (
            <p className={`mt-0.5 text-[11px] leading-relaxed ${ev.done ? "text-dark-text-muted" : "text-dark-text-secondary"} line-clamp-2`}>
              {ev.subtitle}
            </p>
          )
        )}
        <p className="mt-0.5 text-[10px] text-dark-text-muted">
          {timeStr} · {clockStr}
        </p>
        {ev.action && !ev.done && ev.action}
        {ev.retryCallType && (
          <div className="mt-2">
            <CallTriggerButton candidateId={candidateId} callType={ev.retryCallType} label="Retry Call" />
          </div>
        )}
        {ev.extraContent}
      </div>
    </div>
  );

  // If it's a completed call, make it clickable to the call detail page
  if (ev.callId) {
    return (
      <Link href={`/dashboard/calls/${ev.callId}`} className="block rounded-lg hover:bg-white/[0.02]">
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}
