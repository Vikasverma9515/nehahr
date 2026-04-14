"use server";

import { revalidatePath } from "next/cache";

// Server-to-backend calls go through loopback to avoid the corporate
// firewall blocking ngrok. Matches the pattern in schedule.ts and calls.ts.
const BACKEND_URL = "http://localhost:8000";

// Public backend URL (ngrok) is still needed for the Google OAuth redirect,
// because the user's browser follows the link out to Google and back.
const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type HrSenderStatus = {
  connected: boolean;
  email?: string;
  name?: string;
  connected_at?: string;
};

export async function getHrSenderStatus(): Promise<HrSenderStatus> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/hr-sender/`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return { connected: false };
    return (await res.json()) as HrSenderStatus;
  } catch {
    return { connected: false };
  }
}

export async function disconnectHrSender() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/hr-sender/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to disconnect" }));
      return { error: err.detail || "Failed to disconnect" };
    }
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reach backend" };
  }
}

export async function getConnectHrSenderUrl() {
  // The user's browser is about to navigate here and then get bounced to
  // Google — so this URL must be publicly reachable, not localhost.
  return `${PUBLIC_BACKEND_URL}/api/auth/google/start-hr`;
}
