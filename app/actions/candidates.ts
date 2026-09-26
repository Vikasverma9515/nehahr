"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";
import { backendFetch } from "@/app/lib/backend";

export async function deleteCandidate(candidateId: string) {
  // The backend erases everything (calls, interviews, messages, the resume
  // file) and writes an audit entry, which is what an erasure request needs.
  const res = await backendFetch(`/api/candidates/${candidateId}/erase`, { method: "DELETE" }).catch(() => null);
  if (!res || !res.ok) {
    const supabase = await createClient();
    await supabase.from("candidates").delete().eq("id", candidateId);
  }
  redirect("/dashboard/candidates");
}

export async function shortlistCandidate(candidateId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("candidates")
    .update({ stage: "shortlisted" })
    .eq("id", candidateId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/candidates/${candidateId}`);
  revalidatePath("/dashboard/candidates");
  return { success: true };
}

export async function rejectCandidate(candidateId: string, reason?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("candidates")
    .update({
      stage: "rejected",
      qualification_status: "unqualified",
      disqualification_reason: reason || "Rejected by HR",
    })
    .eq("id", candidateId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/candidates/${candidateId}`);
  revalidatePath("/dashboard/candidates");
  return { success: true };
}

export async function sendCandidateMessage(candidateId: string, body: string) {
  const res = await backendFetch(`/api/candidates/${candidateId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { error: (e as { detail?: string }).detail || "Could not send" };
  }
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function rescoreCandidate(candidateId: string) {
  const res = await backendFetch(`/api/candidates/${candidateId}/rescore`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Couldn't re-score" };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { score: (body as { score: number }).score };
}
