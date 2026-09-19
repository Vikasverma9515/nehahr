import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Calendar, Video, ExternalLink, Clock, ChevronRight } from "lucide-react";
import {
  MarkCompleteButton,
  FeedbackButton,
  ReminderCallButton,
  ResultCallButton,
} from "@/app/components/interview-actions";
import { SendEmailButton } from "@/app/components/send-email-button";
import Link from "next/link";
import { PersonAvatar } from "@/app/components/person-avatar";

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; job?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const activeTab = params.tab || "today";

  const { data: interviews } = await supabase
    .from("interviews")
    .select("*, candidates(id, name), jobs(id, title), interviewers(name)")
    .order("scheduled_at", { ascending: true });

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("status", "open");

  const all = (interviews || []) as any[];

  // Filter by job
  const jobFiltered = params.job
    ? all.filter((iv) => iv.jobs?.id === params.job)
    : all;

  // Time boundaries
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);

  // Categorize
  const today = jobFiltered.filter((iv) => {
    if (!iv.scheduled_at || iv.status === "cancelled") return false;
    const d = new Date(iv.scheduled_at);
    return d >= todayStart && d <= todayEnd;
  });

  const thisWeek = jobFiltered.filter((iv) => {
    if (!iv.scheduled_at || iv.status === "cancelled") return false;
    const d = new Date(iv.scheduled_at);
    return d > todayEnd && d <= weekEnd;
  });

  const upcoming = jobFiltered.filter((iv) => {
    if (!iv.scheduled_at || iv.status === "cancelled") return false;
    const d = new Date(iv.scheduled_at);
    return d > weekEnd && iv.status === "scheduled";
  });

  const action = jobFiltered.filter((iv) => {
    const needsFeedback = iv.status === "completed" && iv.feedback_status !== "submitted";
    const needsResult = iv.feedback_status === "submitted" && !iv.result_communicated && iv.result !== "hold";
    return needsFeedback || needsResult;
  });

  const past = jobFiltered.filter((iv) =>
    iv.status === "completed" || iv.status === "cancelled"
  );

  const TABS = [
    { key: "today", label: "Today", count: today.length },
    { key: "week", label: "This Week", count: thisWeek.length },
    { key: "upcoming", label: "Later", count: upcoming.length },
    { key: "action", label: "Action", count: action.length },
    { key: "past", label: "Past", count: past.length },
  ];

  // Select visible interviews based on tab
  let visible: any[];
  switch (activeTab) {
    case "today": visible = today; break;
    case "week": visible = thisWeek; break;
    case "upcoming": visible = upcoming; break;
    case "action": visible = action; break;
    case "past": visible = past.slice(0, 30); break;
    default: visible = today;
  }

  // Group by day for today/week/upcoming tabs
  const groupByDay = ["today", "week", "upcoming"].includes(activeTab);
  const dayGroups: Record<string, any[]> = {};
  if (groupByDay) {
    for (const iv of visible) {
      const d = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
      const key = d
        ? d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
        : "Unscheduled";
      if (!dayGroups[key]) dayGroups[key] = [];
      dayGroups[key].push(iv);
    }
  }

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { tab: params.tab || "today", job: params.job, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    // Remove defaults so URL stays clean
    if (p.get("tab") === "today") p.delete("tab");
    const qs = p.toString();
    return `/dashboard/interviews${qs ? `?${qs}` : ""}`;
  }

  const emptyMessages: Record<string, { title: string; desc: string }> = {
    today: { title: "No interviews today", desc: "Your calendar is clear for today" },
    week: { title: "Nothing this week", desc: "No interviews scheduled for the rest of this week" },
    upcoming: { title: "Nothing scheduled", desc: "No interviews beyond this week" },
    action: { title: "All caught up", desc: "No interviews need your action right now" },
    past: { title: "No past interviews", desc: "Completed interviews will appear here" },
  };

  return (
    <>
      <PageHeader title="Interviews" description="Scheduled and completed interviews" />

      {/* Job filter */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto">
        <Link
          href={buildHref({ job: undefined })}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
            !params.job
              ? "bg-white/[0.08] text-dark-text"
              : "text-dark-text-muted hover:bg-white/[0.04] hover:text-dark-text-secondary"
          }`}
        >
          All Jobs
        </Link>
        {(jobs || []).map((j) => {
          const count = jobFiltered.filter((iv) => iv.jobs?.id === j.id).length;
          if (count === 0 && params.job !== j.id) return null;
          return (
            <Link
              key={j.id}
              href={buildHref({ job: j.id })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                params.job === j.id
                  ? "bg-white/[0.08] text-dark-text"
                  : "text-dark-text-muted hover:bg-white/[0.04] hover:text-dark-text-secondary"
              }`}
            >
              {j.title}
              <span className="ml-1 text-[10px] text-dark-text-muted">{count}</span>
            </Link>
          );
        })}
      </div>

      {/* Time tabs */}
      <div className="mb-5 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {TABS.map(({ key, label, count }) => {
          const isActive = activeTab === key;
          return (
            <Link
              key={key}
              href={buildHref({ tab: key })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-white/[0.08] text-dark-text"
                  : count > 0
                    ? "text-dark-text-muted hover:bg-white/[0.04] hover:text-dark-text-secondary"
                    : "text-dark-text-muted/30 pointer-events-none"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] ${isActive ? "text-dark-text-secondary" : "text-dark-text-muted"}`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {visible.length > 0 ? (
        groupByDay ? (
          <div className="space-y-5">
            {Object.entries(dayGroups).map(([day, interviews]) => (
              <div key={day}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-dark-text-muted">
                  {day}
                </h3>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                  {interviews.map((iv: any) => (
                    <InterviewRow key={iv.id} iv={iv} showTime />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
            {visible.map((iv: any) => (
              <InterviewRow key={iv.id} iv={iv} showDate />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={Calendar}
          art="sitting-10"
          title={emptyMessages[activeTab]?.title || "No interviews"}
          description={emptyMessages[activeTab]?.desc || ""}
        />
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InterviewRow({ iv, showTime, showDate }: { iv: any; showTime?: boolean; showDate?: boolean }) {
  const candidate = iv.candidates as { id: string; name: string } | null;
  const job = iv.jobs as { title: string } | null;
  const interviewer = iv.interviewers as { name: string } | null;
  const scheduledAt = iv.scheduled_at ? new Date(iv.scheduled_at) : null;

  const isScheduled = iv.status === "scheduled";
  const isCompleted = iv.status === "completed";
  const isCancelled = iv.status === "cancelled";
  const needsFeedback = isCompleted && iv.feedback_status !== "submitted";
  const feedbackDone = iv.feedback_status === "submitted";
  const needsResult = feedbackDone && !iv.result_communicated && iv.result !== "hold";

  // Time display
  const timeStr = scheduledAt
    ? scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";
  const dateStr = scheduledAt
    ? scheduledAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  // What does HR need to know?
  let hint = "";
  if (needsFeedback) hint = "Submit feedback";
  else if (needsResult && iv.result === "pass") hint = "HR offer decision needed";
  else if (needsResult) hint = "Auto-rejection call pending";
  else if (isScheduled && !iv.candidate_reminded) hint = "Send reminder";
  else if (iv.result) hint = `Result: ${iv.result}${iv.result_communicated ? " · communicated" : ""}`;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* Time block */}
      <div className="w-16 shrink-0 text-right">
        {showTime && timeStr && (
          <p className="text-[14px] font-bold text-dark-text">{timeStr}</p>
        )}
        {showDate && dateStr && (
          <p className="text-[12px] font-semibold text-dark-text-secondary">{dateStr}</p>
        )}
        {showDate && timeStr && (
          <p className="text-[11px] text-dark-text-muted">{timeStr}</p>
        )}
        {iv.duration_minutes && (
          <p className="text-[10px] text-dark-text-muted">{iv.duration_minutes} min</p>
        )}
      </div>

      {/* Divider line */}
      <div className="h-10 w-px shrink-0 bg-white/[0.08]" />

      <PersonAvatar name={candidate?.name} size={38} className="hidden sm:inline-flex" />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {candidate ? (
            <Link
              href={`/dashboard/candidates/${candidate.id}`}
              className="text-[13px] font-semibold text-dark-text hover:underline"
            >
              {candidate.name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-dark-text">Unknown</span>
          )}
          <span className="text-[11px] text-dark-text-muted">
            {job?.title || ""}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-dark-text-muted">
          {interviewer?.name || "TBD"}
          {hint && <span className="text-dark-text-secondary"> · {hint}</span>}
        </p>
      </div>

      {/* Status + Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {isScheduled && iv.meeting_link && (
          <a
            href={iv.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#7dd4a8]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#7dd4a8] hover:bg-[#7dd4a8]/20"
          >
            <Video className="h-3 w-3" />
            Join
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        {isScheduled && !iv.candidate_reminded && candidate && (
          <ReminderCallButton candidateId={candidate.id} />
        )}
        {isScheduled && (
          <MarkCompleteButton interviewId={iv.id} />
        )}
        {needsFeedback && (
          <FeedbackButton interviewId={iv.id} />
        )}
        {needsResult && iv.result && (
          <SendEmailButton interviewId={iv.id} result={iv.result} />
        )}
        <StatusBadge status={iv.status} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: "text-[#8ab4d9]",
    completed: "text-[#7dd4a8]",
    cancelled: "text-[#e8908a]",
    confirmed: "text-[#b4a0e8]",
  };
  return (
    <span className={`shrink-0 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] border border-white/[0.08] ${colors[status] || "text-dark-text-muted"}`}>
      {status}
    </span>
  );
}
