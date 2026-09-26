"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export type TeamRole = "admin" | "recruiter" | "hiring_manager" | "interviewer" | "viewer";

export async function getTeam() {
  const supabase = await createClient();
  const [{ data: members }, { data: invites }, { data: orgId }] = await Promise.all([
    supabase.rpc("org_member_directory"),
    supabase.from("org_invites").select("id, email, role, created_at").is("accepted_at", null),
    supabase.rpc("current_org_id"),
  ]);
  const { data: org } = orgId
    ? await supabase.from("organizations").select("id, name, slug").eq("id", orgId).single()
    : { data: null };
  return {
    org: org as { id: string; name: string; slug?: string | null } | null,
    members: (members || []) as { user_id: string; email: string; full_name: string | null; role: TeamRole }[],
    invites: (invites || []) as { id: string; email: string; role: TeamRole }[],
  };
}

export async function inviteTeammate(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "recruiter") as TeamRole;
  if (!email.includes("@")) return { error: "Enter a valid email" };

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "You are not part of an organization yet" };

  const { error } = await supabase.from("org_invites").insert({ org_id: orgId, email, role });
  if (error) {
    return { error: error.code === "42501" ? "Only admins can invite teammates" : error.message };
  }
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function revokeInvite(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("org_invites").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function renameOrganization(name: string) {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  const { error } = await supabase.from("organizations").update({ name }).eq("id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}
