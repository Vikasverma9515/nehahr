import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Briefcase, MapPin, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

const PIPELINE_STAGES = [
  "new", "screening", "screened", "shortlisted", "scheduled", "interviewing", "offer", "joined",
] as const;

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  // Get candidate counts + stage breakdown per job
  const jobIds = jobs?.map((j) => j.id) || [];
  const { data: allCandidates } = jobIds.length
    ? await supabase
        .from("candidates")
        .select("job_id, stage")
        .in("job_id", jobIds)
    : { data: [] };

  // Build per-job stats
  const jobStats: Record<string, { total: number; stages: Record<string, number> }> = {};
  for (const jid of jobIds) {
    jobStats[jid] = { total: 0, stages: {} };
  }
  for (const c of allCandidates || []) {
    if (c.job_id && jobStats[c.job_id]) {
      jobStats[c.job_id].total++;
      jobStats[c.job_id].stages[c.stage] = (jobStats[c.job_id].stages[c.stage] || 0) + 1;
    }
  }

  const openJobs = (jobs || []).filter((j) => j.status === "open");
  const otherJobs = (jobs || []).filter((j) => j.status !== "open");

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Manage open positions"
        action={
          <Link
            href="/dashboard/jobs/new"
            className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Create Job
          </Link>
        }
      />

      {jobs && jobs.length > 0 ? (
        <div className="space-y-6">
          {/* Open jobs */}
          {openJobs.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Open Positions
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-bold text-dark-text-muted">
                  {openJobs.length}
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                {openJobs.map((job) => (
                  <JobRow key={job.id} job={job} stats={jobStats[job.id]} />
                ))}
              </div>
            </div>
          )}

          {/* Paused/closed jobs */}
          {otherJobs.length > 0 && (
            <details>
              <summary className="mb-2 flex cursor-pointer items-center gap-2 list-none">
                <ChevronRight className="h-3.5 w-3.5 text-dark-text-muted transition-transform [details[open]>&]:rotate-90" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Paused / Closed
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-bold text-dark-text-muted">
                  {otherJobs.length}
                </span>
              </summary>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                {otherJobs.map((job) => (
                  <JobRow key={job.id} job={job} stats={jobStats[job.id]} />
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No jobs"
          description="Create your first job posting"
          action={
            <Link
              href="/dashboard/jobs/new"
              className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              Create Job
            </Link>
          }
        />
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobRow({ job, stats }: { job: any; stats?: { total: number; stages: Record<string, number> } }) {
  const total = stats?.total || 0;
  const stages = stats?.stages || {};

  return (
    <Link
      href={`/dashboard/jobs/${job.id}`}
      className="flex items-center gap-4 px-4 py-4 transition-all hover:bg-white/[0.03]"
    >
      {/* Job info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-dark-text">{job.title}</span>
          <Badge>{job.status}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-dark-text-muted">
          {job.department && <span>{job.department}</span>}
          {job.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" /> {job.location}
            </span>
          )}
          {job.work_model && <span className="capitalize">{job.work_model}</span>}
          {job.role_type && <span className="capitalize">{job.role_type.replace(/_/g, " ")}</span>}
          {job.salary_range_min && job.salary_range_max && (
            <span>{job.salary_range_min}–{job.salary_range_max} LPA</span>
          )}
        </div>
      </div>

      {/* Mini pipeline — stage dots showing where candidates are */}
      <div className="hidden shrink-0 items-center gap-0.5 md:flex">
        {PIPELINE_STAGES.map((stage) => {
          const count = stages[stage] || 0;
          return (
            <div key={stage} className="flex flex-col items-center" title={`${stage}: ${count}`}>
              <span className={`text-[9px] font-bold ${count > 0 ? "text-dark-text" : "text-dark-text-muted/20"}`}>
                {count > 0 ? count : ""}
              </span>
              <div
                className={`h-1.5 w-6 rounded-full ${count > 0 ? "bg-accent/40" : "bg-white/[0.04]"}`}
              />
            </div>
          );
        })}
      </div>

      {/* Total candidates */}
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-dark-text-secondary">
        <Users className="h-3.5 w-3.5 text-dark-text-muted" />
        <span className="font-bold text-dark-text">{total}</span>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-dark-text-muted/40" />
    </Link>
  );
}
