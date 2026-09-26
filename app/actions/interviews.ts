"use server";

import { backendFetch } from "@/app/lib/backend";

import { revalidatePath } from "next/cache";

export async function markInterviewCompleted(interviewId: string) {
  const res = await backendFetch(`/api/interviews/${interviewId}/complete`, {
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
  const res = await backendFetch(`/api/calls/initiate`, {
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
  const res = await backendFetch(`/api/calls/initiate`, {
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
    const qs = asResult ? `?as=${asResult}` : "";
    const res = await backendFetch(`/api/interviews/${interviewId}/email-template${qs}`);
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
  const res = await backendFetch(`/api/interviews/${interviewId}/send-email`, {
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
  const res = await backendFetch(`/api/interviews/${interviewId}/cancel`, {
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
  const res = await backendFetch(`/api/interviews/${interviewId}/feedback`, {
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

export type NehaRole = "none" | "notetaker" | "co_interviewer" | "lead";

export async function setNehaRole(interviewId: string, role: NehaRole, candidateId: string) {
  const res = await backendFetch(`/api/interviews/${interviewId}`, {
    method: "PATCH",
    body: JSON.stringify({ neha_role: role }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { error: (e as { detail?: string }).detail || "Could not update" };
  }
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function sendNehaToMeet(interviewId: string, candidateId: string) {
  const res = await backendFetch(`/api/interviews/${interviewId}/neha/join`, { method: "POST" });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { error: (e as { detail?: string }).detail || "Could not send Neha" };
  }
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function recallNehaFromMeet(interviewId: string, candidateId: string) {
  await backendFetch(`/api/interviews/${interviewId}/neha/leave`, { method: "POST" }).catch(() => null);
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}
