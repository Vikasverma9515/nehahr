"use server";

// Server actions run server-side, so always hit localhost directly.
// The ngrok URL (BACKEND_URL) is only for Twilio webhooks (external).
const BACKEND_URL = "http://localhost:8000";

export async function triggerCall(candidateId: string, callType: string = "screening") {
  const res = await fetch(`${BACKEND_URL}/api/calls/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidate_id: candidateId,
      call_type: callType,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to initiate call" }));
    return { error: error.detail || "Failed to initiate call" };
  }

  const data = await res.json();
  return { success: true, call_id: data.call_id, status: data.status };
}
