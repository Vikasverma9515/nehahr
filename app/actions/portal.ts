"use server";

import { BACKEND_URL, backendFetch } from "@/app/lib/backend";

export type PortalInfo = {
  first_name: string;
  company: string;
  job_title: string | null;
  stage: string;
  message: string;
  steps: string[];
  step: number;
  next_interview: { scheduled_at: string; interview_type: string; duration_minutes: number; meeting_link: string | null } | null;
  ai_interview_link: string | null;
  can_self_schedule: boolean;
  closed: boolean;
};

export type Slot = { start: string; end: string; label: string; day?: string };

async function call<T>(path: string, init?: RequestInit): Promise<{ data?: T; error?: string }> {
  const res = await fetch(`${BACKEND_URL}/api/portal/public/${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  }).catch(() => null);
  if (!res) return { error: "Couldn't reach us. Please try again." };
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Something went wrong" };
  return { data: body as T };
}

const t = (token: string) => encodeURIComponent(token);

export async function getPortal(token: string) {
  return (await call<PortalInfo>(t(token))).data || null;
}
export async function getSlots(token: string) {
  return call<{ slots: Slot[] }>(`${t(token)}/slots`);
}
export async function bookSlot(token: string, start: string) {
  return call<{ ok: boolean; meeting_link?: string }>(`${t(token)}/book`, { method: "POST", body: JSON.stringify({ start }) });
}
export async function requestCall(token: string, when?: string) {
  return call<{ at: string }>(`${t(token)}/call-me`, { method: "POST", body: JSON.stringify({ when: when || null }) });
}
export async function sendPortalRequest(token: string, kind: string, details: string) {
  return call<{ ok: boolean }>(`${t(token)}/request`, { method: "POST", body: JSON.stringify({ kind, details }) });
}

// Recruiter: copy a candidate's portal link.
export async function getPortalLink(candidateId: string) {
  const res = await backendFetch(`/api/portal/link/${candidateId}`, { method: "POST" });
  if (!res.ok) return { error: "Couldn't create the link" };
  return (await res.json()) as { link: string };
}
