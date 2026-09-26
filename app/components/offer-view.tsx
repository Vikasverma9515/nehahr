"use client";

import { useState, useTransition } from "react";
import { acceptOffer, declineOffer, type PublicOffer } from "@/app/actions/offers";

// The letter is recruiter-editable HTML, so it renders in a sandboxed iframe:
// no scripts, no same-origin access.
const LETTER_CSS = `body{font-family:Georgia,serif;color:#1f1b2e;line-height:1.6;padding:32px;max-width:720px;margin:auto}
table{border-collapse:collapse;width:100%;margin:16px 0}td{border-bottom:1px solid #e6e3f0;padding:8px 4px;font-size:15px}
h2{font-family:-apple-system,Segoe UI,sans-serif}`;

export function OfferView({ token, offer }: { token: string; offer: PublicOffer }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState(offer.status);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white">
        <iframe title="Offer letter" sandbox="" className="h-[640px] w-full"
          srcDoc={`<!doctype html><meta charset="utf-8"><style>${LETTER_CSS}</style>${offer.letter_html}`} />
      </div>
      <div className="card-glass rounded-2xl p-6">
        {status === "accepted" ? (
          <p className="text-[15px] text-emerald-400">Accepted{offer.signature_name ? ` and signed by ${offer.signature_name}` : ""}. Welcome aboard! HR will be in touch about your first day.</p>
        ) : status === "declined" ? (
          <p className="text-[15px] text-dark-text-secondary">You declined this offer. Thank you for letting us know.</p>
        ) : status !== "sent" ? (
          <p className="text-[15px] text-dark-text-secondary">This offer is {status}. Reply to the email if you have questions.</p>
        ) : (
          <>
            <h2 className="text-[16px] font-semibold">Accept your offer</h2>
            <p className="mt-1 text-[12px] text-dark-text-muted">
              Typing your name is your electronic signature. We record the time and the exact letter you signed.
              {offer.expires_at ? ` Valid until ${new Date(offer.expires_at).toLocaleDateString()}.` : ""}
            </p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Full name (${offer.candidate_name || ""})`}
              className="mt-4 block w-full rounded-xl px-4 py-3 text-[18px]" style={{ fontFamily: "cursive" }} />
            <label className="mt-3 flex items-start gap-2 text-[13px] text-dark-text-secondary">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I accept this offer of employment on the terms above.
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={pending || !agree || name.trim().length < 3}
                onClick={() => startTransition(async () => {
                  const r = await acceptOffer(token, name, agree);
                  if (r.error) setError(r.error); else setStatus("accepted");
                })}
                className="btn-primary rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">Accept offer</button>
              <button onClick={() => window.print()} className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-[13px]">Download PDF</button>
              <button onClick={() => setDeclining(!declining)} className="rounded-xl px-4 py-2.5 text-[13px] text-dark-text-muted">Decline</button>
            </div>
            {declining && (
              <div className="mt-3 flex gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, helps us improve)"
                  className="block w-full rounded-xl px-3 py-2 text-[13px]" />
                <button disabled={pending}
                  onClick={() => startTransition(async () => { const r = await declineOffer(token, reason); if (r.error) setError(r.error); else setStatus("declined"); })}
                  className="rounded-xl bg-red-500/70 px-4 py-2 text-[13px] font-semibold text-white">Confirm</button>
              </div>
            )}
            {error && <p className="mt-3 text-[13px] text-amber-400">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
