import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Phone, Clock, ChevronRight, Radio } from "lucide-react";
import Link from "next/link";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab || "overview";
  const supabase = await createClient();

  // All calls
  const { data: allCalls } = await supabase
    .from("calls")
    .select("*, candidates(id, name, stage, score, qualification_status)")
    .order("created_at", { ascending: false })
    .limit(100);

  const calls = allCalls || [];

  // Upcoming auto-calls: interviews needing reminders or result communication
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const { data: pendingReminders } = await supabase
    .from("interviews")
    .select("id, scheduled_at, candidates(id, name), jobs(title)")
    .eq("status", "scheduled")
    .eq("candidate_reminded", false)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", twoHoursLater.toISOString());

  const { data: pendingResults } = await supabase
    .from("interviews")
    .select("id, result, candidates(id, name), jobs(title)")
    .eq("status", "completed")
    .eq("feedback_status", "submitted")
    .eq("result_communicated", false)
    .in("result", ["pass", "fail"]);

  // Categorize calls
  const liveCalls = calls.filter((c) => c.status === "in_progress" || c.status === "ringing");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCalls = calls.filter((c) => new Date(c.created_at) >= todayStart);
  const completedToday = todayCalls.filter((c) => c.status === "completed");

  // Stats
  const avgDuration = completedToday.length > 0
    ? Math.round(completedToday.reduce((s, c) => s + (c.duration_seconds || 0), 0) / completedToday.length)
    : 0;
  const completionRate = todayCalls.length > 0
    ? Math.round((completedToday.length / todayCalls.length) * 100)
    : 0;

  const upcomingCount = (pendingReminders?.length || 0) + (pendingResults?.length || 0);

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "today", label: "Today", count: todayCalls.length },
    { key: "all", label: "All Calls", count: calls.length },
  ];

  return (
    <>
      <PageHeader title="Calls" description="Neha's voice call system" />

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {TABS.map(({ key, label, count }) => (
          <Link
            key={key}
            href={key === "overview" ? "/dashboard/calls" : `?tab=${key}`}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              activeTab === key
                ? "bg-white/[0.08] text-dark-text"
                : "text-dark-text-muted hover:bg-white/[0.04]"
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 text-[10px] text-dark-text-muted">{count}</span>
            )}
          </Link>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-6">
          {/* ── Stats strip ───────────────────────────────────────── */}
          <div className="flex items-center gap-4 overflow-x-auto">
            {[
              ["Calls Today", String(todayCalls.length)],
              ["Completed", String(completedToday.length)],
              ["Avg Duration", avgDuration > 0 ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : "—"],
              ["Completion Rate", completionRate > 0 ? `${completionRate}%` : "—"],
              ["Queued Next", String(upcomingCount)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-[100px] rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">{label}</p>
                <p className="mt-0.5 text-[18px] font-bold text-dark-text">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Live calls ────────────────────────────────────────── */}
          {liveCalls.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#7dd4a8]" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Live Now
                </h2>
              </div>
              <div className="space-y-2">
                {liveCalls.map((call) => {
                  const cand = call.candidates as any;
                  const elapsed = Math.floor((Date.now() - new Date(call.created_at).getTime()) / 1000);
                  return (
                    <Link
                      key={call.id}
                      href={`/dashboard/calls/${call.id}`}
                      className="flex items-center gap-4 rounded-xl border border-accent/20 bg-accent/[0.04] px-4 py-3 transition-all hover:bg-accent/[0.06]"
                    >
                      <Radio className="h-4 w-4 shrink-0 text-accent animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-dark-text">
                          {call.call_type.replace(/_/g, " ")} call with {cand?.name || "Unknown"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-dark-text-muted">
                          {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                        {call.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Upcoming auto-calls ───────────────────────────────── */}
          {upcomingCount > 0 && (
            <div>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                Queued
              </h2>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                {(pendingReminders || []).map((iv: any) => {
                  const cand = iv.candidates as any;
                  const job = iv.jobs as any;
                  const at = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
                  const minsUntil = at ? Math.max(0, Math.floor((at.getTime() - Date.now()) / 60000)) : 0;
                  return (
                    <div key={iv.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4c27d]/10">
                        <Phone className="h-3.5 w-3.5 text-[#d4c27d]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-dark-text">
                          Reminder → {cand?.name || "Unknown"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-dark-text-muted">
                          {job?.title || ""} · Interview {at
                            ? `at ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-[#d4c27d]">
                        in {minsUntil < 60 ? `${minsUntil}m` : `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`}
                      </span>
                    </div>
                  );
                })}
                {(pendingResults || []).map((iv: any) => {
                  const cand = iv.candidates as any;
                  const job = iv.jobs as any;
                  return (
                    <div key={iv.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8ab4d9]/10">
                        <Phone className="h-3.5 w-3.5 text-[#8ab4d9]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-dark-text">
                          Result call → {cand?.name || "Unknown"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-dark-text-muted">
                          {job?.title || ""} · Result: {iv.result}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-[#8ab4d9]">
                        auto
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Recent completed ──────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
              Recent
            </h2>
            {completedToday.length > 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                {completedToday.slice(0, 10).map((call) => (
                  <CallRow key={call.id} call={call} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-[13px] text-dark-text-muted">
                No calls completed today yet
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Today / All tab — simple chronological list ─────────── */
        <div>
          {(activeTab === "today" ? todayCalls : calls).length > 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
              {(activeTab === "today" ? todayCalls : calls).map((call) => (
                <CallRow key={call.id} call={call} showDate={activeTab === "all"} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Phone}
              title="No calls"
              description="Calls will appear here once Neha starts calling"
            />
          )}
        </div>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CallRow({ call, showDate }: { call: any; showDate?: boolean }) {
  const cand = call.candidates as any;
  const createdAt = new Date(call.created_at);
  const timeStr = createdAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dateStr = createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Outcome hint based on call type + candidate data
  let outcome = "";
  if (call.status === "completed") {
    if (call.call_type === "screening" && cand?.score != null) {
      outcome = `Score: ${cand.score}% · ${cand.qualification_status === "qualified" ? "Qualified" : "Not qualified"}`;
    } else if (call.call_type === "scheduling") {
      outcome = cand?.stage === "scheduled" ? "Slot confirmed" : "Needs manual scheduling";
    } else if (call.call_type === "reminder") {
      outcome = "Reminder delivered";
    } else if (call.call_type === "result") {
      outcome = "Result communicated";
    } else if (call.ai_summary) {
      outcome = call.ai_summary;
    }
  } else if (call.status === "failed" || call.status === "no_answer") {
    outcome = call.status === "no_answer" ? "No answer" : "Call failed";
  }

  return (
    <Link
      href={`/dashboard/calls/${call.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-white/[0.03]"
    >
      {/* Time */}
      <div className="w-14 shrink-0 text-right">
        {showDate && <p className="text-[11px] font-semibold text-dark-text-secondary">{dateStr}</p>}
        <p className="text-[12px] font-semibold text-dark-text-secondary">{timeStr}</p>
      </div>

      <div className="h-8 w-px shrink-0 bg-white/[0.06]" />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-dark-text">
            {cand?.name || "Unknown"}
          </span>
          <span className="text-[11px] capitalize text-dark-text-muted">
            {call.call_type.replace(/_/g, " ")}
          </span>
        </div>
        {outcome && (
          <p className="mt-0.5 text-[11px] text-dark-text-secondary">{outcome}</p>
        )}
      </div>

      {/* Duration + status */}
      <div className="flex shrink-0 items-center gap-3">
        {call.duration_seconds != null && (
          <span className="flex items-center gap-1 text-[11px] text-dark-text-muted">
            <Clock className="h-3 w-3" />
            {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
          </span>
        )}
        <span className={`shrink-0 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] border border-white/[0.08] ${
          call.status === "completed" ? "text-[#7dd4a8]"
          : call.status === "in_progress" ? "text-accent"
          : call.status === "ringing" ? "text-[#d4c27d]"
          : "text-dark-text-muted"
        }`}>
          {call.status}
        </span>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-dark-text-muted/40" />
    </Link>
  );
}
