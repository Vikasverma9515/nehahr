"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export async function resolveCandidateRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidate_requests")
    .update({ status: "done", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
