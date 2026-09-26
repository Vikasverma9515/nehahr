"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";
import { backendFetch } from "@/app/lib/backend";

export async function reviewDocument(docId: string, candidateId: string, status: "verified" | "rejected", note?: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("candidate_documents")
    .update({ status, note: note || null, reviewed_at: new Date().toISOString() }).eq("id", docId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function documentUrl(candidateId: string, docId: string) {
  const res = await backendFetch(`/api/candidates/${candidateId}/documents/${docId}/url`);
  if (!res.ok) return { error: "Couldn't open the file" };
  return (await res.json()) as { url: string };
}
