"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export type CallingHours = { start: number; end: number; timezone: string; weekends: boolean };
export type OrgPolicy = { calling_hours: CallingHours; retention_days: number | null };

export async function getOrgPolicy(): Promise<OrgPolicy> {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  const { data } = orgId
    ? await supabase.from("organizations").select("settings").eq("id", orgId).single()
    : { data: null };
  const s = (data?.settings || {}) as Partial<OrgPolicy>;
  return {
    calling_hours: { start: 9, end: 20, timezone: "Asia/Kolkata", weekends: false, ...(s.calling_hours || {}) },
    retention_days: s.retention_days ?? null,
  };
}

export async function saveOrgPolicy(policy: OrgPolicy) {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "No organization" };
  const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  const settings = { ...((data?.settings as object) || {}), ...policy };
  const { error } = await supabase.from("organizations").update({ settings }).eq("id", orgId);
  if (error) return { error: error.code === "42501" ? "Only admins can change this" : error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}
