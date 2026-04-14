import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Users, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  score: number | null;
  qualification_status: string | null;
  needs_manual_scheduling: boolean;
  current_location: string | null;
  scheduling_notes: string | null;
  created_at: string;
  job_id: string | null;
  jobs: { title: string } | null;
};

const STAGE_TABS = [
  { key: "action", label: "Action" },
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "screening", label: "Screening" },
  { key: "screened", label: "Screened" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "scheduled", label: "Scheduled" },
  { key: "interviewing", label: "Interviewing" },
  { key: "done", label: "Done" },
] as const;

function getHint(c: Candidate): string {
  if (c.stage === "screened" && c.qualification_status === "qualified") return "Ready to shortlist";
  if (c.needs_manual_scheduling) return c.scheduling_notes || "Needs manual scheduling";
  if (c.stage === "new") return "Awaiting screening";
  if (c.stage === "screening") return "Neha is screening";
  if (c.stage === "scheduling") return "Neha is scheduling";
  if (c.stage === "scheduled") return "Interview upcoming";
  if (c.stage === "interviewing") return "Awaiting feedback";
  if (c.stage === "offer") return "Offer stage";
  if (c.stage === "joined") return "Joined";
  if (c.stage === "rejected") return "Rejected";
  return "";
}

function isActionNeeded(c: Candidate): boolean {
  return (
    (c.stage === "screened" && c.qualification_status === "qualified") ||
    c.needs_manual_scheduling ||
    (c.stage === "screened" && c.qualification_status === "unqualified")
  );
}

function isDone(c: Candidate): boolean {
  return ["offer", "joined", "rejected", "withdrawn", "pre_joining"].includes(c.stage);
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; job?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const activeTab = params.tab || "all";

  // Fetch all candidates (we filter client-side for tabs)
  let query = supabase
    .from("candidates")
    .select(
      "id, name, email, phone, stage, score, qualification_status, needs_manual_scheduling, scheduling_notes, current_location, created_at, job_id, jobs(title)"
    )
    .order("created_at", { ascending: false });

  if (params.q)
    query = query.or(
      `name.ilike.%${params.q}%,email.ilike.%${params.q}%,phone.ilike.%${params.q}%`
    );

  const { data: rawCandidates } = await query.limit(200);
  const candidates = (rawCandidates || []) as unknown as Candidate[];

  // Jobs for the job filter tabs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("status", "open");

  // Filter by job
  const jobFiltered = params.job
    ? candidates.filter((c) => c.job_id === params.job)
    : candidates;

  // Compute tab counts
  const tabCounts: Record<string, number> = {
    action: jobFiltered.filter(isActionNeeded).length,
    all: jobFiltered.length,
    new: jobFiltered.filter((c) => c.stage === "new").length,
    screening: jobFiltered.filter((c) => c.stage === "screening" || c.stage === "scheduling").length,
    screened: jobFiltered.filter((c) => c.stage === "screened").length,
    shortlisted: jobFiltered.filter((c) => c.stage === "shortlisted").length,
    scheduled: jobFiltered.filter((c) => c.stage === "scheduled").length,
    interviewing: jobFiltered.filter((c) => c.stage === "interviewing").length,
    done: jobFiltered.filter(isDone).length,
  };

  // Apply tab filter
  let visible: Candidate[];
  switch (activeTab) {
    case "action":
      visible = jobFiltered.filter(isActionNeeded);
      break;
    case "new":
      visible = jobFiltered.filter((c) => c.stage === "new");
      break;
    case "screening":
      visible = jobFiltered.filter((c) => c.stage === "screening" || c.stage === "scheduling");
      break;
    case "screened":
      visible = jobFiltered.filter((c) => c.stage === "screened");
      break;
    case "shortlisted":
      visible = jobFiltered.filter((c) => c.stage === "shortlisted");
      break;
    case "scheduled":
      visible = jobFiltered.filter((c) => c.stage === "scheduled");
      break;
    case "interviewing":
      visible = jobFiltered.filter((c) => c.stage === "interviewing");
      break;
    case "done":
      visible = jobFiltered.filter(isDone);
      break;
    default:
      visible = jobFiltered;
  }

  // Build query string helper — preserves other params when switching tabs/jobs
  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { tab: params.tab, job: params.job, q: params.q, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all" && v !== "") p.set(k, v);
    }
    const qs = p.toString();
    return `/dashboard/candidates${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Manage your candidate pipeline"
        action={
          <Link
            href="/dashboard/candidates/new"
            className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Add Candidate
          </Link>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <form className="flex items-center gap-3">
          <input
            name="q"
            type="text"
            placeholder="Search name, email, phone..."
            defaultValue={params.q || ""}
            className="rounded-xl px-4 py-2.5 text-[13px] w-60"
          />
          {params.q && (
            <Link
              href={buildHref({ q: undefined })}
              className="text-[12px] text-dark-text-muted hover:text-dark-text-secondary"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Job filter tabs */}
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
          <span className="ml-1.5 text-[10px] text-dark-text-muted">{candidates.length}</span>
        </Link>
        {(jobs || []).map((j) => {
          const count = candidates.filter((c) => c.job_id === j.id).length;
          if (count === 0) return null;
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
              <span className="ml-1.5 text-[10px] text-dark-text-muted">{count}</span>
            </Link>
          );
        })}
      </div>

      {/* Stage tabs */}
      <div className="mb-5 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {STAGE_TABS.map(({ key, label }) => {
          const count = tabCounts[key] || 0;
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

      {/* Candidate list */}
      {visible.length > 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
          {visible.map((c) => (
            <CandidateRow key={c.id} candidate={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={activeTab === "all" ? "No candidates" : `No ${activeTab} candidates`}
          description={
            activeTab === "action"
              ? "Nothing needs your attention right now"
              : activeTab === "all"
                ? "Add your first candidate to get started"
                : `No candidates in the ${activeTab} stage`
          }
          action={
            activeTab === "all" ? (
              <Link
                href="/dashboard/candidates/new"
                className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
              >
                Add Candidate
              </Link>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function CandidateRow({ candidate: c }: { candidate: Candidate }) {
  const job = c.jobs as unknown as { title: string } | null;
  const hint = getHint(c);

  return (
    <Link
      href={`/dashboard/candidates/${c.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-white/[0.03]"
    >
      {/* Score */}
      {c.score != null ? (
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${(c.score / 100) * 88} 88`} />
          </svg>
          <span className="text-[10px] font-bold text-dark-text">{c.score}</span>
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06]">
          <span className="text-[9px] text-dark-text-muted">—</span>
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-dark-text">{c.name}</span>
          {c.current_location && (
            <span className="hidden items-center gap-0.5 text-[10px] text-dark-text-muted md:inline-flex">
              <MapPin className="h-2.5 w-2.5" /> {c.current_location}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-dark-text-muted">
          {job?.title || "No role"}
          {hint && <span className="text-dark-text-secondary"> · {hint}</span>}
        </p>
      </div>

      {/* Badge */}
      <Badge>{c.stage}</Badge>

      <ChevronRight className="h-4 w-4 shrink-0 text-dark-text-muted/40" />
    </Link>
  );
}
