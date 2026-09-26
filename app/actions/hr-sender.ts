"use server";

import { backendFetch, signedBackendUrl } from "@/app/lib/backend";

import { revalidatePath } from "next/cache";

export type HrSenderStatus = {
  connected: boolean;
  email?: string;
  name?: string;
  connected_at?: string;
};

export async function getHrSenderStatus(): Promise<HrSenderStatus> {
  try {
    const res = await backendFetch(`/api/hr-sender/`, {
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
    const res = await backendFetch(`/api/hr-sender/`, {
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
  return signedBackendUrl("/api/auth/google/start-hr", 600);
}
