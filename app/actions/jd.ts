"use server";

import { backendFetch } from "@/app/lib/backend";

export async function draftJobDescription(input: {
  title: string; notes: string; location?: string; workModel?: string; skills?: string; salary?: string;
}) {
  const res = await backendFetch("/api/jobs/draft-description", {
    method: "POST",
    body: JSON.stringify({
      title: input.title, notes: input.notes, location: input.location || null,
      work_model: input.workModel || null,
      skills: (input.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
      salary: input.salary || null,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Couldn't draft" };
  return { description: (body as { description: string }).description };
}
