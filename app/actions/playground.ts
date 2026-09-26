"use server";

import { backendFetch } from "@/app/lib/backend";

export type PlaygroundOptions = {
  candidateId: string;
  callType: string;
  tts?: string;
  avatar?: boolean;
};

export type PlaygroundSession = {
  call_id: string;
  room: string;
  url: string;
  token: string;
};

export async function startPlaygroundSession(
  opts: PlaygroundOptions,
): Promise<{ session?: PlaygroundSession; error?: string }> {
  try {
    const res = await backendFetch("/api/agent/playground/session", {
      method: "POST",
      body: JSON.stringify({
        candidate_id: opts.candidateId,
        call_type: opts.callType,
        tts: opts.tts || undefined,
        avatar: !!opts.avatar,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.detail || `Backend returned ${res.status}` };
    return { session: body as PlaygroundSession };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach the backend" };
  }
}

export async function endPlaygroundSession(callId: string) {
  await backendFetch(`/api/agent/playground/${callId}/end`, { method: "POST" }).catch(() => null);
}
