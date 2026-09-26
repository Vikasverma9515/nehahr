"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/app/lib/backend";

export type ImportSummary = {
  columns: Record<string, string>;
  created: number;
  would_create: number;
  duplicates: { name: string; phone: string }[];
  errors: { line: number; name?: string; error: string }[];
  preview: Record<string, unknown>[];
};

export type ResumeResult = {
  file: string;
  status: "created" | "duplicate" | "error";
  name?: string;
  candidate_id?: string;
  needs_phone?: boolean;
  match_score?: number | null;
  error?: string;
};

async function errorOf(res: Response) {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail || `Upload failed (${res.status})`;
}

export async function importCsv(formData: FormData): Promise<{ summary?: ImportSummary; error?: string }> {
  const res = await backendFetch("/api/candidates/import", { method: "POST", body: formData });
  if (!res.ok) return { error: await errorOf(res) };
  if (formData.get("dry_run") !== "true") revalidatePath("/dashboard/candidates");
  return { summary: (await res.json()) as ImportSummary };
}

export async function uploadResumes(formData: FormData): Promise<{ results?: ResumeResult[]; error?: string }> {
  const res = await backendFetch("/api/candidates/resumes", { method: "POST", body: formData });
  if (!res.ok) return { error: await errorOf(res) };
  revalidatePath("/dashboard/candidates");
  return { results: ((await res.json()) as { results: ResumeResult[] }).results };
}
