import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { JobInterviewerPicker } from "@/app/components/job-interviewer-picker";
import { MapPin, Users, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/app/components/person-avatar";
import { ScreeningBuilder } from "@/app/components/screening-builder";
import { ShareReviewButton } from "@/app/components/share-review-button";
import type { ScreeningConfig } from "@/app/actions/screening";

const STAGE_ORDER = [
  "new", "screening", "screened", "shortlisted", "scheduling", "scheduled",
  "interviewing", "offer", "joined", "rejected",
] as const;

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const activeStage = sp.stage || "all";

  const { data: job } = await supabase
    .from("jobs")
    .select("*, interviewers:default_interviewer_id(name, email)")
    .eq("id", id)
    .single();
  if (!job) notFound();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, name, stage, score, email, current_location, created_at")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  const { data: allInterviewers } = await supabase
    .from("interviewers")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  // Stage counts
  const stageCounts: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => (stageCounts[s] = 0));
  candidates?.forEach((c) => {
    if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
  });

  // Filtered candidates
  const visible =
    activeStage === "all"
      ? candidates || []
      : (candidates || []).filter((c) => c.stage === activeStage);

  const assignedInterviewer = job.interviewers as unknown as {
    name: string;
    email: string;
  } | null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-dark-text">{job.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-dark-text-muted">
            {job.department && <span>{job.department}</span>}
            {job.location && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {job.location}
              </span>
            )}
            {job.work_model && <span className="capitalize">{job.work_model}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ShareReviewButton jobId={job.id} />
          <Badge>{job.status}</Badge>
        </div>
      </div>

      {/* ── Job details row ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
        {[
          ["Role Type", job.role_type?.replace(/_/g, " ") || "-"],
          [
            "Salary Range",
            job.salary_range_min && job.salary_range_max
              ? `${job.salary_range_min}–${job.salary_range_max} LPA`
              : "-",
          ],
          ["Skills", job.required_skills?.join(", ") || "-"],
          ["Rounds", String(job.total_interview_rounds || 1)],
          ["Candidates", String(candidates?.length || 0)],
        ].map(([label, value]) => (
          <div key={label as string} className="min-w-[100px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
              {label}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold capitalize text-dark-text">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Screening setup ────────────────────────────────────── */}
      <Card>
        <ScreeningBuilder jobId={job.id} initial={(job.screening_config || null) as ScreeningConfig | null} />
      </Card>

      {/* ── Interviewer picker ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3">
        <div>
          <p className="text-[12px] font-semibold text-dark-text-secondary">
            Default Interviewer
          </p>
          <p className="text-[11px] text-dark-text-muted">
            Neha uses this interviewer&apos;s calendar for scheduling
          </p>
        </div>
        <div className="flex items-center gap-3">
          {assignedInterviewer && (
            <span className="inline-flex items-center gap-2 text-[12px] text-dark-text-secondary">
              <PersonAvatar name={assignedInterviewer.name} size={24} />
              {assignedInterviewer.name}
            </span>
          )}
          <JobInterviewerPicker
            jobId={job.id}
            currentInterviewerId={job.default_interviewer_id}
            interviewers={allInterviewers || []}
          />
        </div>
      </div>

      {/* ── Pipeline tabs + candidates ─────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
          Candidate Pipeline
        </h2>

        {/* Stage tabs */}
        <div className="mb-4 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          <Link
            href={`/dashboard/jobs/${id}`}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              activeStage === "all"
                ? "bg-white/[0.08] text-dark-text"
                : "text-dark-text-muted hover:bg-white/[0.04]"
            }`}
          >
            All
            <span className="ml-1 text-[10px] text-dark-text-muted">
              {candidates?.length || 0}
            </span>
          </Link>
          {STAGE_ORDER.map((stage) => {
            const count = stageCounts[stage] || 0;
            if (count === 0) return null;
            return (
              <Link
                key={stage}
                href={`/dashboard/jobs/${id}?stage=${stage}`}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
                  activeStage === stage
                    ? "bg-white/[0.08] text-dark-text"
                    : "text-dark-text-muted hover:bg-white/[0.04]"
                }`}
              >
                {stage.replace(/_/g, " ")}
                <span className="ml-1 text-[10px] text-dark-text-muted">
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Candidate list */}
        {visible.length > 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
            {visible.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/candidates/${c.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-white/[0.03]"
              >
                {/* Score */}
                {c.score != null ? (
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                    <svg
                      viewBox="0 0 36 36"
                      className="absolute inset-0 h-full w-full -rotate-90"
                    >
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
                      />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${(c.score / 100) * 88} 88`}
                      />
                    </svg>
                    <span className="text-[10px] font-bold text-dark-text">
                      {c.score}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06]">
                    <span className="text-[9px] text-dark-text-muted">—</span>
                  </div>
                )}

                <PersonAvatar name={c.name} size={34} className="hidden sm:inline-flex" />

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-dark-text">
                    {c.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-dark-text-muted">
                    {c.email || ""}
                    {c.current_location
                      ? `${c.email ? " · " : ""}${c.current_location}`
                      : ""}
                  </p>
                </div>

                <Badge>{c.stage}</Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-dark-text-muted/40" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[13px] text-dark-text-muted">
            {activeStage === "all"
              ? "No candidates for this job yet"
              : `No candidates in ${activeStage.replace(/_/g, " ")}`}
          </p>
        )}
      </div>
    </div>
  );
}
