import { createClient } from "@/app/lib/supabase/server";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Phone,
  Sparkles,
  Video,
  ExternalLink,
  AlertTriangle,
  UserCheck,
  Mail,
  PhoneOff,
  Users,
} from "lucide-react";
import {
  MarkCompleteButton,
  FeedbackButton,
  ReminderCallButton,
} from "@/app/components/interview-actions";
import { SendEmailButton } from "@/app/components/send-email-button";
import { CallTriggerButton } from "@/app/components/call-trigger-button";
import { ShortlistButton, RejectButton } from "@/app/components/stage-actions";

const PIPELINE_STAGES = [
  "new", "screening", "screened", "shortlisted", "scheduling",
  "scheduled", "interviewing", "offer", "joined",
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    jobsResult,
    allCandidates,
    todayInterviews,
    recentCalls,
    failedCalls,
    readyForOffer,
    scoredCandidates,
  ] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("candidates").select(
      "id, name, stage, score, qualification_status, needs_manual_scheduling, scheduling_notes, created_at, jobs(title)"
    ).order("created_at", { ascending: false }),
    supabase.from("interviews").select(
      "id, scheduled_at, interview_type, duration_minutes, meeting_link, status, feedback_status, result, candidate_reminded, candidates(id, name), jobs(title), interviewers(name)"
    ).eq("status", "scheduled")
      .gte("scheduled_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lte("scheduled_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase.from("calls").select(
      "id, call_type, status, duration_seconds, ai_summary, created_at, candidates(id, name)"
    ).order("created_at", { ascending: false }).limit(8),
    supabase.from("calls").select(
      "id, call_type, status, created_at, candidates(id, name)"
    ).in("status", ["failed", "no_answer", "busy"])
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(5),
    // Candidates who passed final round — need offer email
    supabase.from("interviews").select(
      "id, result, candidate_id, result_communicated, candidates(id, name, stage), jobs(title, total_interview_rounds)"
    ).eq("feedback_status", "submitted")
      .eq("result", "pass")
      .eq("result_communicated", false)
      .limit(10),
    // Candidates with scores awaiting shortlist decision
    supabase.from("candidates").select("id, name, score, qualification_status, jobs(title)")
      .eq("stage", "screened")
      .eq("qualification_status", "qualified")
      .order("score", { ascending: false })
      .limit(10),
  ]);

  const candidates = allCandidates.data || [];

  // Compute counts
  const unscreenedCount = candidates.filter((c) => c.stage === "new").length;
  const needsShortlist = scoredCandidates.data || [];
  const needsScheduling = candidates.filter((c) => c.stage === "shortlisted" && !c.needs_manual_scheduling).length;
  const manualScheduling = candidates.filter((c) => c.needs_manual_scheduling).length;
  const todayIntCount = todayInterviews.data?.length || 0;
  const offerReady = readyForOffer.data || [];
  const failedCount = failedCalls.data?.length || 0;

  // Pipeline counts
  const pipelineCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => (pipelineCounts[s] = 0));
  candidates.forEach((c) => {
    if (pipelineCounts[c.stage] !== undefined) pipelineCounts[c.stage]++;
  });
  const maxCount = Math.max(1, ...PIPELINE_STAGES.map((s) => pipelineCounts[s] || 0));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Briefing
  const parts: string[] = [];
  if (needsShortlist.length > 0) parts.push(`${needsShortlist.length} ready to shortlist`);
  if (offerReady.length > 0) parts.push(`${offerReady.length} ready for offer`);
  if (todayIntCount > 0) parts.push(`${todayIntCount} interview${todayIntCount > 1 ? "s" : ""} today`);
  if (unscreenedCount > 0) parts.push(`${unscreenedCount} to screen`);
  if (manualScheduling > 0) parts.push(`${manualScheduling} need manual scheduling`);
  if (failedCount > 0) parts.push(`${failedCount} failed call${failedCount > 1 ? "s" : ""} this week`);
  if (parts.length === 0) parts.push("All caught up. No pending actions.");

  return (
    <div className="space-y-5">
      {/* ── Briefing ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[14px] font-semibold text-dark-text">{greeting}! Here's your update.</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-dark-text-secondary">{parts.join(" · ")}</p>
          </div>
        </div>
      </div>

      {/* ── Live counter bar ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <CounterCard
          href="/dashboard/candidates?tab=new"
          label="Need screening"
          value={unscreenedCount}
          icon={Phone}
          color="#d4c27d"
        />
        <CounterCard
          href="/dashboard/candidates?tab=action"
          label="Ready to shortlist"
          value={needsShortlist.length}
          icon={UserCheck}
          color="#7dd4a8"
        />
        <CounterCard
          href="/dashboard/candidates?tab=shortlisted"
          label="To schedule"
          value={needsScheduling}
          icon={Calendar}
          color="#8ab4d9"
        />
        <CounterCard
          href="/dashboard/interviews?tab=today"
          label="Today's interviews"
          value={todayIntCount}
          icon={Video}
          color="#b4a0e8"
        />
        <CounterCard
          href="/dashboard/candidates?tab=action"
          label="Ready for offer"
          value={offerReady.length}
          icon={Mail}
          color="#7dd4a8"
        />
        <CounterCard
          href="/dashboard/calls"
          label="Failed calls (7d)"
          value={failedCount}
          icon={PhoneOff}
          color="#e8908a"
        />
      </div>

      {/* ── Row 1: Today + Shortlist decisions ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Today's Agenda — action-rich */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Today's Interviews</h2>
            <span className="text-[11px] text-dark-text-muted">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
          {todayIntCount > 0 ? (
            <div className="space-y-2.5">
              {todayInterviews.data!.map((iv: any) => {
                const cand = iv.candidates as { id: string; name: string } | null;
                const job = iv.jobs as { title: string } | null;
                const intr = iv.interviewers as { name: string } | null;
                const time = iv.scheduled_at
                  ? new Date(iv.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                  : "";
                return (
                  <div key={iv.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-accent" />
                          <span className="text-[14px] font-bold text-dark-text">{time}</span>
                        </div>
                        <p className="mt-1 text-[13px] font-semibold text-dark-text">
                          {cand?.name || "Unknown"}
                          <span className="font-normal text-dark-text-muted"> — {job?.title || ""}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-dark-text-muted">
                          {intr?.name || "TBD"} · {(iv.interview_type || "video").replace(/_/g, " ")} · {iv.duration_minutes || 60} min
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                      {iv.meeting_link && (
                        <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#7dd4a8]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#7dd4a8] hover:bg-[#7dd4a8]/20">
                          <Video className="h-3 w-3" /> Join <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {!iv.candidate_reminded && cand && (
                        <ReminderCallButton candidateId={cand.id} />
                      )}
                      <MarkCompleteButton interviewId={iv.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6">
              <Calendar className="h-7 w-7 text-dark-text-muted/40" />
              <p className="mt-3 text-[13px] text-dark-text-muted">No interviews today</p>
            </div>
          )}
        </Card>

        {/* Shortlist queue — inline actions */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Ready to Shortlist</h2>
            {needsShortlist.length > 0 && (
              <span className="rounded-full bg-[#7dd4a8]/10 px-2 py-0.5 text-[10px] font-bold text-[#7dd4a8]">
                {needsShortlist.length}
              </span>
            )}
          </div>
          {needsShortlist.length > 0 ? (
            <div className="space-y-1">
              {needsShortlist.slice(0, 5).map((c) => {
                const job = c.jobs as any;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
                    {/* Score */}
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                          strokeDasharray={`${((c.score || 0) / 100) * 88} 88`} />
                      </svg>
                      <span className="text-[10px] font-bold text-dark-text">{c.score}</span>
                    </div>
                    <Link href={`/dashboard/candidates/${c.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="text-[13px] font-semibold text-dark-text">{c.name}</p>
                      <p className="truncate text-[11px] text-dark-text-muted">{job?.title || "—"}</p>
                    </Link>
                    <div className="flex shrink-0 gap-1.5">
                      <ShortlistButton candidateId={c.id} />
                      <RejectButton candidateId={c.id} />
                    </div>
                  </div>
                );
              })}
              {needsShortlist.length > 5 && (
                <Link href="/dashboard/candidates?tab=action"
                  className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] font-medium text-dark-text-secondary hover:bg-white/[0.03]">
                  View all {needsShortlist.length} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6">
              <Check className="h-7 w-7 text-dark-text-muted/40" />
              <p className="mt-3 text-[13px] text-dark-text-muted">No pending decisions</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 2: Offer-ready + Failed calls ───────────────────── */}
      {(offerReady.length > 0 || failedCount > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ready for offer */}
          {offerReady.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Ready for Offer</h2>
                <span className="rounded-full bg-[#7dd4a8]/10 px-2 py-0.5 text-[10px] font-bold text-[#7dd4a8]">
                  {offerReady.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {offerReady.slice(0, 4).map((iv: any) => {
                  const cand = iv.candidates as { id: string; name: string; stage: string } | null;
                  const job = iv.jobs as { title: string } | null;
                  return (
                    <div key={iv.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7dd4a8]/10">
                        <Check className="h-3.5 w-3.5 text-[#7dd4a8]" />
                      </div>
                      <Link href={`/dashboard/candidates/${cand?.id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="text-[13px] font-semibold text-dark-text">{cand?.name}</p>
                        <p className="truncate text-[11px] text-dark-text-muted">{job?.title} · passed final round</p>
                      </Link>
                      <SendEmailButton interviewId={iv.id} result="pass" />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Failed calls */}
          {failedCount > 0 && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Failed Calls</h2>
                <span className="rounded-full bg-[#e8908a]/10 px-2 py-0.5 text-[10px] font-bold text-[#e8908a]">
                  {failedCount}
                </span>
              </div>
              <div className="space-y-1.5">
                {failedCalls.data!.map((call: any) => {
                  const cand = call.candidates as { id: string; name: string } | null;
                  const when = new Date(call.created_at);
                  const timeStr = when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  return (
                    <div key={call.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5">
                      <PhoneOff className="h-3.5 w-3.5 shrink-0 text-[#e8908a]" />
                      <Link href={`/dashboard/candidates/${cand?.id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="text-[13px] font-semibold text-dark-text">{cand?.name}</p>
                        <p className="truncate text-[11px] text-dark-text-muted">
                          {call.call_type.replace(/_/g, " ")} · {call.status.replace(/_/g, " ")} · {timeStr}
                        </p>
                      </Link>
                      {cand && (
                        <CallTriggerButton candidateId={cand.id} callType={call.call_type} label="Retry" />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      <Card>
        <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Pipeline</h2>
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipelineCounts[stage] || 0;
            const h = count > 0 ? Math.max(20, (count / maxCount) * 72) : 6;
            return (
              <Link key={stage} href={`/dashboard/candidates?tab=${stage === "scheduling" ? "screening" : stage}`}
                className="group flex min-w-[56px] flex-1 flex-col items-center gap-1.5">
                <span className={`text-[13px] font-bold ${count > 0 ? "text-dark-text" : "text-dark-text-muted/30"}`}>
                  {count}
                </span>
                <div className={`w-full rounded-md transition-opacity group-hover:opacity-80 ${count > 0 ? "bg-accent/40" : "bg-white/[0.03]"}`}
                  style={{ height: `${h}px` }} />
                <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-dark-text-muted text-center leading-tight">
                  {stage.replace(/_/g, " ")}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* ── Row 3: Activity + Manual scheduling ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Activity feed */}
        <Card>
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Recent Activity</h2>
          {recentCalls.data && recentCalls.data.length > 0 ? (
            <div className="space-y-1">
              {recentCalls.data.slice(0, 6).map((call: any) => {
                const cand = call.candidates as { id: string; name: string } | null;
                return (
                  <Link key={call.id} href={`/dashboard/calls/${call.id}`}
                    className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]">
                    <Phone className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      call.status === "completed" ? "text-[#7dd4a8]"
                      : call.status === "in_progress" ? "text-accent"
                      : "text-dark-text-muted"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold capitalize text-dark-text">{call.call_type.replace(/_/g, " ")}</span>
                        <span className="text-[11px] text-dark-text-muted">{cand?.name || "—"}</span>
                      </div>
                      {call.ai_summary && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-dark-text-muted line-clamp-1">
                          {call.ai_summary}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-dark-text-muted">{_timeAgo(call.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-dark-text-muted">No activity yet</p>
          )}
        </Card>

        {/* Manual scheduling queue */}
        <Card>
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">Needs Manual Scheduling</h2>
          {manualScheduling > 0 ? (
            <div className="space-y-1">
              {candidates.filter((c) => c.needs_manual_scheduling).slice(0, 5).map((c) => {
                const job = c.jobs as any;
                return (
                  <Link key={c.id} href={`/dashboard/candidates/${c.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#d4c27d]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-dark-text">{c.name}</p>
                      <p className="truncate text-[11px] text-dark-text-muted">
                        {job?.title || "—"} · {c.scheduling_notes || "Candidate rejected all slots"}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-dark-text-muted/40" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6">
              <Check className="h-7 w-7 text-dark-text-muted/40" />
              <p className="mt-3 text-[13px] text-dark-text-muted">No manual scheduling needed</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Quick actions ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction href="/dashboard/candidates/new" icon={Users} label="Add Candidate" />
        <QuickAction href="/dashboard/jobs/new" icon={Calendar} label="Create Job" />
        <QuickAction href="/dashboard/interviews" icon={Video} label="All Interviews" />
        <QuickAction href="/dashboard/calls" icon={Phone} label="Call History" />
      </div>

      {/* ── Footer stats ────────────────────────────────────────── */}
      <div className="flex items-center justify-around rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-dark-text-muted">
        <span>{jobsResult.count || 0} open positions</span>
        <span>·</span>
        <span>{candidates.length} total candidates</span>
        <span>·</span>
        <span>
          {(() => {
            const scored = candidates.filter((c) => c.qualification_status === "qualified" || c.qualification_status === "unqualified");
            if (scored.length === 0) return "— pass rate";
            const passed = scored.filter((c) => c.qualification_status === "qualified").length;
            return `${Math.round((passed / scored.length) * 100)}% pass rate`;
          })()}
        </span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CounterCard({ href, label, value, icon: Icon, color }: {
  href: string; label: string; value: number; icon: any; color: string;
}) {
  const isZero = value === 0;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1.5 rounded-xl border px-3.5 py-3 transition-all ${
        isZero
          ? "border-white/[0.04] bg-white/[0.01] pointer-events-none"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5" style={{ color: isZero ? "rgba(255,255,255,0.15)" : color }} />
        <span className={`text-[20px] font-bold leading-none ${isZero ? "text-dark-text-muted/30" : "text-dark-text"}`}>
          {value}
        </span>
      </div>
      <span className={`text-[10px] font-medium uppercase tracking-[0.06em] ${isZero ? "text-dark-text-muted/30" : "text-dark-text-muted"}`}>
        {label}
      </span>
    </Link>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuickAction({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
        <Icon className="h-4 w-4 text-dark-text-secondary" />
      </div>
      <span className="text-[12px] font-semibold text-dark-text">{label}</span>
    </Link>
  );
}

function _timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
