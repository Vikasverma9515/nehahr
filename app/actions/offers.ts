"use server";

import { revalidatePath } from "next/cache";
import { BACKEND_URL, backendFetch } from "@/app/lib/backend";

export type OfferRow = {
  id: string;
  status: string;
  designation: string;
  ctc: { fixed?: number; variable?: number; joining_bonus?: number };
  joining_date: string | null;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  approval_required: boolean;
  decline_reason: string | null;
  signature_name: string | null;
  token: string;
  letter_html?: string;
};

async function detail(res: Response) {
  const b = await res.json().catch(() => ({}));
  return (b as { detail?: string }).detail || `Request failed (${res.status})`;
}

export async function createOffer(candidateId: string, form: {
  designation: string; fixed: number; variable: number; bonus: number; joiningDate: string; location: string; reportingTo: string; expiresInDays: number;
}) {
  const res = await backendFetch("/api/offers", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidateId, designation: form.designation, fixed_lpa: form.fixed, variable_lpa: form.variable,
      joining_bonus_lpa: form.bonus, joining_date: form.joiningDate || null, work_location: form.location || null,
      reporting_to: form.reportingTo || null, expires_in_days: form.expiresInDays,
    }),
  });
  if (!res.ok) return { error: await detail(res) };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { offer: (await res.json()) as OfferRow };
}

export async function updateOfferLetter(offerId: string, letterHtml: string, candidateId: string) {
  const res = await backendFetch(`/api/offers/${offerId}`, { method: "PATCH", body: JSON.stringify({ letter_html: letterHtml }) });
  if (!res.ok) return { error: await detail(res) };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

export async function offerAction(offerId: string, action: "approve" | "send" | "withdraw", candidateId: string) {
  const res = await backendFetch(`/api/offers/${offerId}/${action}`, { method: "POST" });
  if (!res.ok) return { error: await detail(res) };
  revalidatePath(`/dashboard/candidates/${candidateId}`);
  return { success: true };
}

// ── Candidate side ──────────────────────────────────────────────────────

export type PublicOffer = {
  status: string;
  candidate_name: string | null;
  designation: string;
  letter_html: string;
  expires_at: string | null;
  signature_name: string | null;
  responded_at: string | null;
};

export async function getPublicOffer(token: string): Promise<PublicOffer | null> {
  const res = await fetch(`${BACKEND_URL}/api/offers/public/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as PublicOffer;
}

async function publicPost(token: string, action: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}/api/offers/public/${encodeURIComponent(token)}/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  }).catch(() => null);
  if (!res) return { error: "Couldn't reach us. Try again." };
  if (!res.ok) return { error: await detail(res) };
  return { success: true };
}

export async function acceptOffer(token: string, fullName: string, agree: boolean) {
  return publicPost(token, "accept", { full_name: fullName, agree });
}
export async function declineOffer(token: string, reason: string) {
  return publicPost(token, "decline", { reason });
}
