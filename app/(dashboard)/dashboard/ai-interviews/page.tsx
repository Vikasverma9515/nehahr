import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Video, Clock, Radio, CheckCircle2, XCircle, Eye } from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/app/components/person-avatar";

const STATUS_COLORS: Record<string, { text: string; bg: string; label: string }> = {
  pending: { text: "text-[#d4c27d]", bg: "bg-[#d4c27d]/10", label: "Pending" },
  in_progress: { text: "text-accent", bg: "bg-accent/10", label: "Live" },
  completed: { text: "text-[#7dd4a8]", bg: "bg-[#7dd4a8]/10", label: "Completed" },
  cancelled: { text: "text-[#e8908a]", bg: "bg-[#e8908a]/10", label: "Cancelled" },
  no_show: { text: "text-[#e8908a]", bg: "bg-[#e8908a]/10", label: "No-show" },
};

export default async function AiInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab || "all";
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("ai_interviews")
    .select(
      "id, status, score, summary, completed_at, created_at, room_name, candidates(id, name, stage), jobs(id, title)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const all = (rows || []) as any[];

  const live = all.filter((r) => r.status === "in_progress");
  const pending = all.filter((r) => r.status === "pending");
  const completed = all.filter((r) => r.status === "completed");
  const ended = all.filter((r) => r.status === "cancelled" || r.status === "no_show");

  const TABS = [
    { key: "all", label: "All", count: all.length },
    { key: "live", label: "Live", count: live.length },
    { key: "pending", label: "Pending", count: pending.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  const visible =
    activeTab === "live"
      ? live
      : activeTab === "pending"
        ? pending
        : activeTab === "completed"
          ? completed
          : all;

  return (
    <>
      <PageHeader
        title="AI Interviews"
        description="Automated video interviews conducted by Neha"
      />

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {TABS.map(({ key, label, count }) => {
          const isActive = activeTab === key;
          return (
            <Link
              key={key}
              href={key === "all" ? "/dashboard/ai-interviews" : `?tab=${key}`}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-white/[0.08] text-dark-text"
                  : count > 0
                    ? "text-dark-text-muted hover:bg-white/[0.04] hover:text-dark-text-secondary"
                    : "pointer-events-none text-dark-text-muted/30"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-[10px] ${isActive ? "text-dark-text-secondary" : "text-dark-text-muted"}`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Live interviews — highlighted */}
      {activeTab !== "live" && live.length > 0 && (
        <div className="mb-5 rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-accent" />
            <p className="text-[13px] font-semibold text-accent">
              {live.length} interview{live.length > 1 ? "s" : ""} in progress
            </p>
          </div>
          <div className="space-y-1.5">
            {live.map((r) => {
              const cand = one(r.candidates);
              const job = one(r.jobs);
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <PersonAvatar name={cand?.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-dark-text">{cand?.name || "Unknown"}</span>
                    {job?.title && (
                      <span className="ml-2 text-[11px] text-dark-text-muted">{job.title}</span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/ai-interviews/${r.id}/watch`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover"
                  >
                    <Eye className="h-3 w-3" /> Watch live
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main list */}
      {visible.length > 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
          {visible.map((r) => {
            const cand = one(r.candidates);
            const job = one(r.jobs);
            const status = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
            const isLive = r.status === "in_progress";
            const when = r.completed_at || r.created_at;
            const dateStr = new Date(when).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                {/* Status icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${status.bg}`}
                >
                  {isLive ? (
                    <Radio className={`h-4 w-4 ${status.text} animate-pulse`} />
                  ) : r.status === "completed" ? (
                    <CheckCircle2 className={`h-4 w-4 ${status.text}`} />
                  ) : r.status === "cancelled" || r.status === "no_show" ? (
                    <XCircle className={`h-4 w-4 ${status.text}`} />
                  ) : (
                    <Video className={`h-4 w-4 ${status.text}`} />
                  )}
                </div>

                <PersonAvatar name={cand?.name} size={36} className="hidden sm:inline-flex" />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {cand ? (
                      <Link
                        href={`/dashboard/candidates/${cand.id}`}
                        className="text-[13px] font-semibold text-dark-text hover:underline"
                      >
                        {cand.name}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold text-dark-text">Unknown</span>
                    )}
                    {job?.title && (
                      <span className="text-[11px] text-dark-text-muted">{job.title}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-dark-text-muted">
                    <Clock className="h-3 w-3" />
                    {dateStr}
                    {r.summary && (
                      <span className="hidden text-dark-text-secondary md:inline">
                        · {r.summary.slice(0, 60)}{r.summary.length > 60 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                {r.score != null && (
                  <div className="relative hidden h-9 w-9 shrink-0 items-center justify-center sm:flex">
                    <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${(r.score / 100) * 88} 88`}
                      />
                    </svg>
                    <span className="text-[10px] font-bold text-dark-text">{r.score}</span>
                  </div>
                )}

                {/* Status badge + action */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${status.bg} ${status.text}`}
                  >
                    {isLive ? "Live" : status.label}
                  </span>
                  {isLive && (
                    <Link
                      href={`/dashboard/ai-interviews/${r.id}/watch`}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/25"
                    >
                      <Eye className="h-3 w-3" /> Watch
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Video}
          art="sitting-10"
          title={activeTab === "live" ? "No live interviews" : "No AI interviews yet"}
          description="AI video interviews will appear here once scheduled"
        />
      )}
    </>
  );
}

function one<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}
