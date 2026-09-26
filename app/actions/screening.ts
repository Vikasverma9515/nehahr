"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";
import { backendFetch } from "@/app/lib/backend";

export type ScreeningQuestion = { text: string; what_good_looks_like?: string };
export type MustHaves = {
  max_notice_days?: number | null;
  min_experience_years?: number | null;
  max_expected_ctc_lpa?: number | null;
  locations?: string[];
  allow_relocation?: boolean;
  work_models?: string[];
};
export type ScreeningConfig = {
  questions?: ScreeningQuestion[];
  interview_questions?: { text: string }[];
  knockouts?: string[];
  must_haves?: MustHaves;
  language?: string;
};

export async function saveScreeningConfig(jobId: string, config: ScreeningConfig) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ screening_config: config }).eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { success: true };
}

export async function generateScreening(jobId: string): Promise<{ draft?: ScreeningConfig; error?: string }> {
  const res = await backendFetch(`/api/jobs/${jobId}/screening/generate`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Couldn't draft questions" };
  return { draft: body as ScreeningConfig };
}
