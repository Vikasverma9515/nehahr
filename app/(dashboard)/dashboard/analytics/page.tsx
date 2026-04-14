import { createClient } from "@/app/lib/supabase/server";
import { Card } from "@/app/components/ui/card";
import {
  Users,
  Phone,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
} from "lucide-react";

const FUNNEL_STAGES = [
  "new",
  "screening",
  "screened",
  "shortlisted",
  "scheduled",
  "interviewing",
  "offer",
  "joined",
] as const;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [candidatesRes, callsRes, interviewsRes, jobsRes] = await Promise.all([
    supabase.from("candidates").select("id, stage, qualification_status, score, created_at, job_id"),
    supabase.from("calls").select("id, call_type, status, duration_seconds, created_at"),
    supabase.from("interviews").select("id, status, result, feedback_status, scheduled_at"),
    supabase.from("jobs").select("id, title, status"),
  ]);

  const candidates = candidatesRes.data || [];
  const calls = callsRes.data || [];
  const interviews = interviewsRes.data || [];
  const jobs = jobsRes.data || [];

  // ── Funnel counts ──────────────────────────────────────────
  const stageCounts: Record<string, number> = {};
  FUNNEL_STAGES.forEach((s) => (stageCounts[s] = 0));
  candidates.forEach((c) => {
    if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
  });
  const maxStage = Math.max(1, ...FUNNEL_STAGES.map((s) => stageCounts[s] || 0));

  // ── Conversion rates ───────────────────────────────────────
  const screened = candidates.filter((c) =>
    ["screened", "shortlisted", "scheduled", "interviewing", "offer", "joined"].includes(c.stage)
  ).length;
  const qualified = candidates.filter((c) => c.qualification_status === "qualified").length;
  const unqualified = candidates.filter((c) => c.qualification_status === "unqualified").length;
  const shortlisted = candidates.filter((c) =>
    ["shortlisted", "scheduled", "interviewing", "offer", "joined"].includes(c.stage)
  ).length;
  const interviewed = candidates.filter((c) =>
    ["interviewing", "offer", "joined"].includes(c.stage)
  ).length;
  const offered = candidates.filter((c) =>
    ["offer", "joined"].includes(c.stage)
  ).length;
  const joined = candidates.filter((c) => c.stage === "joined").length;
  const rejected = candidates.filter((c) => c.stage === "rejected").length;
  const withdrawn = candidates.filter((c) => c.stage === "withdrawn").length;

  // Pass rates
  const screeningPassRate = (qualified + unqualified) > 0
    ? Math.round((qualified / (qualified + unqualified)) * 100)
    : null;
  const interviewPassRate = (() => {
    const withResult = interviews.filter((i) => i.result === "pass" || i.result === "fail");
    if (withResult.length === 0) return null;
    const passed = interviews.filter((i) => i.result === "pass").length;
    return Math.round((passed / withResult.length) * 100);
  })();
  const offerAcceptanceRate = offered > 0
    ? Math.round((joined / offered) * 100)
    : null;
  const overallConversion = candidates.length > 0
    ? Math.round((joined / candidates.length) * 100)
    : null;

  // ── Call stats ─────────────────────────────────────────────
  const completedCalls = calls.filter((c) => c.status === "completed");
  const failedCalls = calls.filter((c) => ["failed", "no_answer", "busy"].includes(c.status));
  const callCompletionRate = calls.length > 0
    ? Math.round((completedCalls.length / calls.length) * 100)
    : null;
  const avgCallDuration = completedCalls.length > 0
    ? Math.round(completedCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / completedCalls.length)
    : 0;

  // Call type breakdown
  const callsByType: Record<string, { total: number; completed: number }> = {};
  calls.forEach((c) => {
    if (!callsByType[c.call_type]) {
      callsByType[c.call_type] = { total: 0, completed: 0 };
    }
    callsByType[c.call_type].total++;
    if (c.status === "completed") callsByType[c.call_type].completed++;
  });

  // ── Score distribution ─────────────────────────────────────
  const scored = candidates.filter((c) => c.score != null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, c) => s + (c.score || 0), 0) / scored.length)
    : null;
  const scoreBuckets = {
    excellent: scored.filter((c) => (c.score || 0) >= 80).length,
    good: scored.filter((c) => (c.score || 0) >= 60 && (c.score || 0) < 80).length,
    weak: scored.filter((c) => (c.score || 0) < 60).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-dark-text">Analytics</h1>
        <p className="mt-0.5 text-[13px] text-dark-text-muted">
          Hiring pipeline metrics, conversion rates, and AI call performance
        </p>
      </div>

      {/* ── Top KPIs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Candidates"
          value={candidates.length}
          color="#b0b1c4"
        />
        <KpiCard
          icon={Phone}
          label="AI Calls Made"
          value={calls.length}
          color="#b4a0e8"
          sub={callCompletionRate != null ? `${callCompletionRate}% completion` : undefined}
        />
        <KpiCard
          icon={TrendingUp}
          label="Screening Pass Rate"
          value={screeningPassRate != null ? `${screeningPassRate}%` : "—"}
          color="#7dd4a8"
          sub={screeningPassRate != null ? `${qualified}/${qualified + unqualified} candidates` : undefined}
        />
        <KpiCard
          icon={Target}
          label="Overall Conversion"
          value={overallConversion != null ? `${overallConversion}%` : "—"}
          color="#d4c27d"
          sub={joined > 0 ? `${joined} joined out of ${candidates.length}` : "No joins yet"}
        />
      </div>

      {/* ── Hiring Funnel ──────────────────────────────────────── */}
      <Card>
        <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">
          Hiring Funnel
        </h2>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = stageCounts[stage] || 0;
            const width = (count / maxStage) * 100;
            const prevCount = i > 0 ? (stageCounts[FUNNEL_STAGES[i - 1]] || 0) : count;
            const dropRate = i > 0 && prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : null;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] font-medium capitalize text-dark-text-secondary">
                  {stage.replace(/_/g, " ")}
                </span>
                <div className="flex-1">
                  <div className="relative h-7 rounded-lg bg-white/[0.03]">
                    <div
                      className="flex h-7 items-center rounded-lg bg-accent/20 px-3 text-[11px] font-bold text-dark-text transition-all"
                      style={{ width: `${Math.max(width, count > 0 ? 6 : 0)}%` }}
                    >
                      {count > 0 && count}
                    </div>
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  {dropRate != null && dropRate > 0 && i > 0 ? (
                    <span className="text-[10px] text-[#e8908a]">-{dropRate}%</span>
                  ) : (
                    <span className="text-[10px] text-dark-text-muted">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Final summary */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Rejected</p>
            <p className="mt-1 text-[16px] font-bold text-[#e8908a]">{rejected}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Withdrawn</p>
            <p className="mt-1 text-[16px] font-bold text-[#d4c27d]">{withdrawn}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Joined</p>
            <p className="mt-1 text-[16px] font-bold text-[#7dd4a8]">{joined}</p>
          </div>
        </div>
      </Card>

      {/* ── Conversion rates + Scores ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">
            Conversion Rates
          </h2>
          <div className="space-y-4">
            <ConversionBar
              label="Screening → Pass"
              value={screeningPassRate}
              detail={`${qualified} qualified / ${qualified + unqualified} screened`}
            />
            <ConversionBar
              label="Interview → Pass"
              value={interviewPassRate}
              detail={`Based on submitted feedback`}
            />
            <ConversionBar
              label="Offer → Acceptance"
              value={offerAcceptanceRate}
              detail={`${joined} joined / ${offered} offered`}
            />
            <ConversionBar
              label="End-to-end conversion"
              value={overallConversion}
              detail={`${joined} joined / ${candidates.length} total candidates`}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">
            Screening Score Distribution
          </h2>
          {scored.length > 0 ? (
            <>
              <div className="mb-5 flex items-center gap-4">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${((avgScore || 0) / 100) * 213.6} 213.6`}
                    />
                  </svg>
                  <span className="font-display text-[24px] font-bold text-dark-text">{avgScore || "—"}</span>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] text-dark-text-muted">Average Score</p>
                  <p className="mt-0.5 text-[13px] text-dark-text">Based on {scored.length} scored candidates</p>
                </div>
              </div>

              <div className="space-y-2">
                <ScoreBucket label="Excellent (80+)" count={scoreBuckets.excellent} total={scored.length} color="#7dd4a8" />
                <ScoreBucket label="Good (60-79)" count={scoreBuckets.good} total={scored.length} color="#8b5cf6" />
                <ScoreBucket label="Weak (<60)" count={scoreBuckets.weak} total={scored.length} color="#e8908a" />
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-dark-text-muted">
              No scored candidates yet
            </p>
          )}
        </Card>
      </div>

      {/* ── Call Performance ──────────────────────────────────── */}
      <Card>
        <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">
          AI Call Performance
        </h2>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Total Calls</p>
            <p className="mt-1 text-[20px] font-bold text-dark-text">{calls.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Completed</p>
            <p className="mt-1 text-[20px] font-bold text-[#7dd4a8]">{completedCalls.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Failed / No Answer</p>
            <p className="mt-1 text-[20px] font-bold text-[#e8908a]">{failedCalls.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">Avg Duration</p>
            <p className="mt-1 text-[20px] font-bold text-dark-text">
              {avgCallDuration > 0 ? `${Math.floor(avgCallDuration / 60)}m ${avgCallDuration % 60}s` : "—"}
            </p>
          </div>
        </div>

        {/* By type */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-secondary">
            Calls by Type
          </p>
          {Object.keys(callsByType).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(callsByType)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([type, stats]) => {
                  const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[12px] capitalize text-dark-text-secondary">
                        {type.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1">
                        <div className="relative h-6 rounded-lg bg-white/[0.03]">
                          <div
                            className="h-6 rounded-lg bg-accent/20 transition-all"
                            style={{ width: `${(stats.total / calls.length) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex w-32 shrink-0 items-center justify-end gap-3 text-[11px]">
                        <span className="font-bold text-dark-text">{stats.total}</span>
                        <span className="text-dark-text-muted">·</span>
                        <span className={rate >= 80 ? "text-[#7dd4a8]" : rate >= 60 ? "text-[#d4c27d]" : "text-[#e8908a]"}>
                          {rate}% ok
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="py-4 text-center text-[12px] text-dark-text-muted">No call data yet</p>
          )}
        </div>
      </Card>

      {/* ── Interview outcomes ────────────────────────────────── */}
      {interviews.length > 0 && (
        <Card>
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text">
            Interview Outcomes
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <OutcomeCard
              icon={Calendar}
              label="Scheduled"
              value={interviews.filter((i) => i.status === "scheduled").length}
              color="#8ab4d9"
            />
            <OutcomeCard
              icon={CheckCircle2}
              label="Completed"
              value={interviews.filter((i) => i.status === "completed").length}
              color="#7dd4a8"
            />
            <OutcomeCard
              icon={XCircle}
              label="Cancelled"
              value={interviews.filter((i) => i.status === "cancelled").length}
              color="#e8908a"
            />
            <OutcomeCard
              icon={Clock}
              label="Awaiting Feedback"
              value={interviews.filter((i) => i.status === "completed" && i.feedback_status !== "submitted").length}
              color="#d4c27d"
            />
          </div>
        </Card>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <p className="text-center text-[11px] text-dark-text-muted">
        {jobs.filter((j) => j.status === "open").length} open positions · Data refreshed on page load
      </p>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <p className="mt-3 text-[24px] font-bold leading-none text-dark-text">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-dark-text-muted">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-dark-text-muted">{sub}</p>}
    </div>
  );
}

function ConversionBar({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  const width = value != null ? Math.min(100, Math.max(2, value)) : 0;
  const color = value == null ? "#787994" : value >= 70 ? "#7dd4a8" : value >= 40 ? "#d4c27d" : "#e8908a";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-dark-text-secondary">{label}</span>
        <span className="text-[13px] font-bold" style={{ color }}>
          {value != null ? `${value}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: value == null ? "transparent" : color, opacity: 0.7 }}
        />
      </div>
      <p className="mt-1 text-[10px] text-dark-text-muted">{detail}</p>
    </div>
  );
}

function ScoreBucket({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[11px] text-dark-text-secondary">{label}</span>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-white/[0.05]">
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.6 }} />
        </div>
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] font-bold text-dark-text">{count}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OutcomeCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <p className="text-[10px] uppercase tracking-[0.1em] text-dark-text-muted">{label}</p>
      </div>
      <p className="mt-2 text-[20px] font-bold text-dark-text">{value}</p>
    </div>
  );
}
