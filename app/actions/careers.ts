"use server";

import { revalidatePath } from "next/cache";
import { BACKEND_URL } from "@/app/lib/backend";
import { createClient } from "@/app/lib/supabase/server";

export type PublicJob = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  work_model: string | null;
  job_description: string | null;
  required_skills: string[] | null;
  salary_range_min: number | null;
  salary_range_max: number | null;
  created_at: string;
};

export async function getCareers(slug: string) {
  const res = await fetch(`${BACKEND_URL}/api/careers/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as { company: string; jobs: PublicJob[] };
}

export async function getCareerJob(slug: string, jobId: string) {
  const res = await fetch(`${BACKEND_URL}/api/careers/${encodeURIComponent(slug)}/${encodeURIComponent(jobId)}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as { company: string; job: PublicJob };
}

export async function applyToJob(slug: string, jobId: string, formData: FormData) {
  const res = await fetch(`${BACKEND_URL}/api/careers/${encodeURIComponent(slug)}/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { error: "Couldn't reach us. Please try again." };
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Couldn't submit your application" };
  return { success: true };
}

// Recruiter: publish settings for a job.
export async function setJobPublishing(jobId: string, published: boolean, autoScreenMinMatch: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ published, auto_screen_min_match: autoScreenMinMatch })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { success: true };
}
