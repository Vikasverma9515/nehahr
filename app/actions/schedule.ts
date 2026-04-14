"use server";

import { revalidatePath } from "next/cache";

// Server actions run in the same process as Next.js on the dev machine, so
// we always hit the backend over loopback. The public BACKEND_URL (ngrok) is
// only needed for Twilio webhooks — not for internal server-to-backend calls.
// Corporate firewalls (FortiGuard) block ngrok as "Proxy Avoidance", so going
// through localhost avoids the firewall entirely.
const BACKEND_URL = "http://localhost:8000";

export async function previewSlots(candidateId: string, interviewerId?: string) {
  const params = new URLSearchParams({ candidate_id: candidateId });
  if (interviewerId) params.set("interviewer_id", interviewerId);

  const url = `${BACKEND_URL}/api/interviews/slots/preview?${params}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });

    if (!res.ok) {
      // Try JSON first; if that fails, fall back to the raw text body so we
      // don't mask the real error behind a generic string.
      const body = await res.text().catch(() => "");
      let detail = body;
      try {
        const parsed = JSON.parse(body);
        detail = parsed.detail || body;
      } catch {
        // not JSON — keep raw body
      }
      console.error(
        `[previewSlots] ${res.status} ${res.statusText} from ${url}\n${body}`
      );
      return {
        error: `Backend ${res.status}: ${detail || res.statusText || "unknown error"}`,
      };
    }

    return { data: await res.json() };
  } catch (e) {
    console.error(`[previewSlots] fetch threw for ${url}:`, e);
    return {
      error: e instanceof Error ? `Network: ${e.message}` : "Failed to reach backend",
    };
  }
}

export async function listInterviewers() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/interviewers/`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.interviewers || data || []) as { id: string; name: string; email: string }[];
  } catch {
    return [];
  }
}

export async function triggerSchedulingCall(
  candidateId: string,
  interviewerId?: string,
  selectedSlots?: { start: string; end: string; label: string }[],
  interviewType?: string,
  durationMinutes?: number,
) {
  const url = `${BACKEND_URL}/api/interviews/trigger-scheduling-call`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_id: candidateId,
        interviewer_id: interviewerId,
        selected_slots: selectedSlots,
        interview_type: interviewType,
        duration_minutes: durationMinutes,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body;
      try {
        const parsed = JSON.parse(body);
        detail = parsed.detail || body;
      } catch {
        // not JSON — keep raw body
      }
      console.error(
        `[triggerSchedulingCall] ${res.status} ${res.statusText} from ${url}\n${body}`
      );
      return {
        error: `Backend ${res.status}: ${detail || res.statusText || "unknown error"}`,
      };
    }

    // Refresh candidate detail page so the manual-scheduling banner
    // and stage pill update immediately.
    revalidatePath(`/dashboard/candidates/${candidateId}`);
    return { data: await res.json() };
  } catch (e) {
    console.error(`[triggerSchedulingCall] fetch threw for ${url}:`, e);
    return {
      error: e instanceof Error ? `Network: ${e.message}` : "Failed to reach backend",
    };
  }
}
