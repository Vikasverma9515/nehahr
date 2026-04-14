"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export async function deleteCandidate(candidateId: string) {
  const supabase = await createClient();

  // Delete in order: interviews → calls → candidate (cascade handles it, but be explicit)
  await supabase.from("interviews").delete().eq("candidate_id", candidateId);
  await supabase.from("calls").delete().eq("candidate_id", candidateId);
  await supabase.from("candidates").delete().eq("id", candidateId);

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
