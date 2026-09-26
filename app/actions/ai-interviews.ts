"use server";

import { revalidatePath } from "next/cache";
import { BACKEND_URL, backendFetch } from "@/app/lib/backend";

export type RoomJoin = { url: string; token: string; room: string };

async function detail(res: Response) {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail || `Request failed (${res.status})`;
}

// ── Recruiter side ──────────────────────────────────────────────────────

export async function inviteToAiInterview(candidateId: string, expiresInHours = 72) {
  const res = await backendFetch("/api/ai-interviews", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, expires_in_hours: expiresInHours, send_email: true }),
  });
  if (!res.ok) return { error: await detail(res) };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return (await res.json()) as { link: string; emailed: boolean };
}

export async function cancelAiInterview(id: string, candidateId: string) {
  const res = await backendFetch(`/api/ai-interviews/${id}/cancel`, { method: "POST" });
  if (!res.ok) return { error: await detail(res) };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function observeAiInterview(id: string): Promise<{ join?: RoomJoin; error?: string }> {
  const res = await backendFetch(`/api/ai-interviews/${id}/observe`, { method: "POST" });
  if (!res.ok) return { error: await detail(res) };
  return { join: (await res.json()) as RoomJoin };
}

// ── Candidate side (no session: the link token is the credential) ───────

export type PublicInterview = {
  first_name: string;
  job_title: string | null;
  company: string;
  status: string;
  expires_at: string;
  attempts_left: number;
};

export async function getPublicInterview(token: string): Promise<PublicInterview | null> {
  const res = await fetch(`${BACKEND_URL}/api/ai-interviews/public/${encodeURIComponent(token)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as PublicInterview;
}

export async function joinPublicInterview(
  token: string,
  consent: boolean,
  displayName?: string,
): Promise<{ join?: RoomJoin; error?: string }> {
  const res = await fetch(`${BACKEND_URL}/api/ai-interviews/public/${encodeURIComponent(token)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent, display_name: displayName || undefined }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { error: "Could not reach the interview service. Please try again." };
  if (!res.ok) return { error: await detail(res) };
  return { join: (await res.json()) as RoomJoin };
}
