"use server";

import { revalidatePath } from "next/cache";

const BACKEND_URL = "http://localhost:8000";

export async function markInterviewCompleted(interviewId: string) {
  const res = await fetch(`${BACKEND_URL}/api/interviews/${interviewId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to mark as completed" };
  }
  revalidatePath("/dashboard/interviews");
  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard");
  return { success: true };
}

export type FeedbackData = {
  technical_skills: number;
  communication: number;
  culture_fit: number;
  overall: number;
  recommendation: string;
  strengths: string;
  concerns: string;
  notes: string;
  result: string;
};

export async function triggerReminderCall(candidateId: string) {
  const res = await fetch(`${BACKEND_URL}/api/calls/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: candidateId, call_type: "reminder" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to trigger reminder" };
  }
  revalidatePath("/dashboard/interviews");
  return { success: true };
}

export async function triggerResultCall(candidateId: string) {
  const res = await fetch(`${BACKEND_URL}/api/calls/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: candidateId, call_type: "result" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to trigger result call" };
  }
  revalidatePath("/dashboard/interviews");
  return { success: true };
}

export type EmailTemplate = {
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
  result: string;
};

export async function getEmailTemplate(
  interviewId: string,
  asResult?: "pass" | "hold" | "fail"
): Promise<EmailTemplate | null> {
  try {
    const url = new URL(`${BACKEND_URL}/api/interviews/${interviewId}/email-template`);
    if (asResult) url.searchParams.set("as", asResult);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EmailTemplate;
  } catch {
    return null;
  }
}

export async function sendResultEmail(
  interviewId: string,
  data: { to_email: string; subject: string; body: string }
) {
  const res = await fetch(`${BACKEND_URL}/api/interviews/${interviewId}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to send email" };
  }
  revalidatePath("/dashboard/interviews");
  revalidatePath("/dashboard/candidates");
  return { success: true };
}

export async function cancelInterview(
  interviewId: string,
  opts: { reason?: string; reschedule?: boolean } = {}
) {
  const res = await fetch(`${BACKEND_URL}/api/interviews/${interviewId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: opts.reason || null,
      reschedule: opts.reschedule ?? true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to cancel interview" };
  }
  const data = await res.json();
  revalidatePath("/dashboard/interviews");
  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard");
  return { success: true, ...data };
}

export async function submitFeedback(interviewId: string, data: FeedbackData) {
  const res = await fetch(`${BACKEND_URL}/api/interviews/${interviewId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    return { error: err.detail || "Failed to submit feedback" };
  }
  revalidatePath("/dashboard/interviews");
  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard");
  return { success: true };
}
