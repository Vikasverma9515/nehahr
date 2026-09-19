"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || "http://localhost:8000";

export async function listInterviewers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviewers")
    .select("id, name, email, timezone, working_hours_start, working_hours_end, is_active, google_connected_at")
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, interviewers: [] };
  return { interviewers: data || [] };
}

export async function createInterviewer(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("interviewers").insert({
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
    working_hours_start: Number(formData.get("working_hours_start") || 9),
    working_hours_end: Number(formData.get("working_hours_end") || 18),
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function deleteInterviewer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("interviewers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function getConnectGoogleUrl(interviewerId: string) {
  // Redirect user to backend OAuth start endpoint, which will bounce them to Google
  return `${BACKEND_URL}/api/auth/google/start?interviewer_id=${interviewerId}`;
}
