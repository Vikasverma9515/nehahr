import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/ui/page-header";
import { PersonAvatar } from "@/app/components/person-avatar";
import Link from "next/link";
import {
  Clock, CheckCircle2, XCircle, Radio, Video, ArrowLeft,
  MessageSquare, BarChart3, Eye, User, Briefcase,
} from "lucide-react";

const STATUS_COLORS: Record<string, { text: string; bg: string; label: string }> = {
  pending:     { text: "text-[#d4c27d]",  bg: "bg-[#d4c27d]/10",  label: "Pending" },
  in_progress: { text: "text-accent",      bg: "bg-accent/10",     label: "Live" },
  completed:   { text: "text-[#7dd4a8]",  bg: "bg-[#7dd4a8]/10",  label: "Completed" },
  cancelled:   { text: "text-[#e8908a]",  bg: "bg-[#e8908a]/10",  label: "Cancelled" },
  no_show:     { text: "text-[#e8908a]",  bg: "bg-[#e8908a]/10",  label: "No-show" },
};

function one<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}

export default async function AiInterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("ai_interviews")
    .select(
      "*, candidates(id, name, email, phone, stage, score), jobs(id, title, department)"
    )
    .eq("id", id)
    .single();

  if (!row) notFound();

  const cand = one(row.candidates) as { id: string; name: string; email?: string; phone?: string; stage: string; score: number | null } | null;
  const job  = one(row.jobs)       as { id: string; title: string; department?: string } | null;

  // Fetch transcript from calls table if linked
  const { data: call } = row.call_id
    ? await supabase
        .from("calls")
        .select("id, ai_summary, extracted_data, duration_seconds, created_at")
        .eq("id", row.call_id)
        .single()
    : { data: null };

  const status = STATUS_COLORS[row.status] || STATUS_COLORS.pending;
  const isLive = row.status === "in_progress";
  const isDone = row.status === "completed";

  const when = row.completed_at || row.created_at;
  const dateStr = new Date(when).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  // Score breakdown from extracted_data if available
  const extracted = call?.extracted_data as Record<string, unknown> | null;
  const scoreBreakdown = extracted?.score_breakdown as Record<string, number> | null;

  return (
    <>
      <PageHeader
        title={cand?.name || "AI Interview"}
        description={`AI video interview${job?.title ? ` · ${job.title}` : ""} · ${dateStr}`}
        action={
          <Link
            href="/dashboard/ai-interviews"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All interviews
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Left column ──────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">

          {/* Live banner */}
          {isLive && (
            <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/[0.04] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
                <p className="text-[14px] font-semibold text-accent">Interview in progress</p>
              </div>
              <Link
                href={`/dashboard/ai-interviews/${id}/watch`}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover"
              >
                <Eye className="h-3.5 w-3.5" /> Watch live
              </Link>
            </div>
          )}

          {/* Summary */}
          {row.summary && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
                <MessageSquare className="h-3.5 w-3.5" /> Neha's Summary
              </h2>
              <p className="text-[13px] leading-relaxed text-dark-text-secondary">{row.summary}</p>
            </div>
          )}

          {/* AI call summary */}
          {call?.ai_summary && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
                <MessageSquare className="h-3.5 w-3.5" /> Call Summary
              </h2>
              <p className="text-[13px] leading-relaxed text-dark-text-secondary">{call.ai_summary}</p>
              {call.duration_seconds && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-dark-text-muted">
                  <Clock className="h-3 w-3" />
                  {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                  <span className="mx-1">·</span>
                  <Link href={`/dashboard/calls/${call.id}`} className="text-accent hover:underline">
                    View full transcript
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Score breakdown */}
          {scoreBreakdown && Object.keys(scoreBreakdown).length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
              <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
                <BarChart3 className="h-3.5 w-3.5" /> Score Breakdown
              </h2>
              <div className="space-y-3">
                {Object.entries(scoreBreakdown).map(([key, val]) => {
                  const pct = Math.round((val / 10) * 100);
                  const color = val >= 7 ? "#7dd4a8" : val >= 5 ? "#d4c27d" : "#e8908a";
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[11px] capitalize text-dark-text-secondary">
                        {key.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-white/[0.05]">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
                          />
                        </div>
                      </div>
                      <span className="w-8 shrink-0 text-right text-[11px] font-bold" style={{ color }}>
                        {val}/10
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Placeholder if no content yet */}
          {!row.summary && !call?.ai_summary && !isLive && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-12 text-center">
              {row.status === "pending" ? (
                <>
                  <Video className="mx-auto mb-3 h-8 w-8 text-dark-text-muted/40" />
                  <p className="text-[13px] font-medium text-dark-text-secondary">Waiting for the candidate</p>
                  <p className="mt-1 text-[12px] text-dark-text-muted">
                    The interview link has been sent. Summary and score will appear here once they complete it.
                  </p>
                </>
              ) : (
                <>
                  <Video className="mx-auto mb-3 h-8 w-8 text-dark-text-muted/40" />
                  <p className="text-[13px] font-medium text-dark-text-secondary">No summary available</p>
                  <p className="mt-1 text-[12px] text-dark-text-muted">
                    The interview ended without generating a summary.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
              Status
            </h2>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${status.bg}`}>
                {isLive ? (
                  <Radio className={`h-5 w-5 ${status.text} animate-pulse`} />
                ) : isDone ? (
                  <CheckCircle2 className={`h-5 w-5 ${status.text}`} />
                ) : row.status === "cancelled" || row.status === "no_show" ? (
                  <XCircle className={`h-5 w-5 ${status.text}`} />
                ) : (
                  <Video className={`h-5 w-5 ${status.text}`} />
                )}
              </div>
              <div>
                <p className={`text-[15px] font-bold ${status.text}`}>{status.label}</p>
                <p className="text-[11px] text-dark-text-muted">{dateStr}</p>
              </div>
            </div>

            {row.score != null && (
              <div className="mt-5 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${(row.score / 100) * 163} 163`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[18px] font-bold text-dark-text">
                    {row.score}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-dark-text-muted">Overall score</p>
                  <p className="text-[13px] font-semibold text-dark-text">
                    {row.score >= 80 ? "Excellent" : row.score >= 60 ? "Good" : "Needs review"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Candidate card */}
          {cand && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
                Candidate
              </h2>
              <Link href={`/dashboard/candidates/${cand.id}`} className="flex items-center gap-3 hover:opacity-80">
                <PersonAvatar name={cand.name} size={40} shape="soft" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-dark-text">{cand.name}</p>
                  <p className="text-[11px] capitalize text-dark-text-muted">{cand.stage}</p>
                </div>
              </Link>
              {(cand.email || cand.phone) && (
                <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3">
                  {cand.email && (
                    <p className="flex items-center gap-2 text-[11px] text-dark-text-muted">
                      <User className="h-3 w-3 shrink-0" />
                      {cand.email}
                    </p>
                  )}
                  {cand.phone && (
                    <p className="flex items-center gap-2 text-[11px] text-dark-text-muted">
                      <User className="h-3 w-3 shrink-0" />
                      {cand.phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Job card */}
          {job && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-5 py-4">
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
                Position
              </h2>
              <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center gap-3 hover:opacity-80">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Briefcase className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-dark-text">{job.title}</p>
                  {job.department && (
                    <p className="text-[11px] text-dark-text-muted">{job.department}</p>
                  )}
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
