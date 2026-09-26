"use server";

import { BACKEND_URL, backendFetch } from "@/app/lib/backend";

export type ReviewCandidate = {
  id: string;
  name: string;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  current_location: string | null;
  current_title: string | null;
  current_company: string | null;
  experience_years: number | null;
  notice_period_days: number | null;
  expected_ctc: Record<string, number> | null;
  current_ctc: Record<string, number> | null;
  skills: string[] | null;
  match_score: number | null;
  match_reasons: { strengths?: string[]; gaps?: string[]; one_line?: string } | null;
  screening_summary: string | null;
  ai_interview: { score: number | null; summary: string | null } | null;
  decision: { decision: string; note: string | null } | null;
};

export type ReviewPage = {
  job_title: string | null;
  reviewer_name: string | null;
  message: string | null;
  candidates: ReviewCandidate[];
};

export async function createReviewLink(jobId: string, reviewerName: string, reviewerEmail: string, message: string) {
  const res = await backendFetch("/api/reviews", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      reviewer_name: reviewerName || null,
      reviewer_email: reviewerEmail || null,
      message: message || null,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "Couldn't create the link" };
  return body as { link: string; emailed: boolean; count: number };
}

export async function getReviewPage(token: string): Promise<{ page?: ReviewPage; error?: string }> {
  const res = await fetch(`${BACKEND_URL}/api/reviews/public/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "Couldn't load the review" };
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { detail?: string }).detail || "This link isn't valid" };
  return { page: body as ReviewPage };
}

export async function submitDecision(token: string, candidateId: string, decision: string, note: string) {
  const res = await fetch(`${BACKEND_URL}/api/reviews/public/${encodeURIComponent(token)}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: candidateId, decision, note }),
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return { error: "Couldn't save. Try again." };
  return { success: true };
}
