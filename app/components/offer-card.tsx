"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { createOffer, offerAction, updateOfferLetter, type OfferRow } from "@/app/actions/offers";
import { useToast } from "@/app/components/ui/toast";

const input = "block w-full rounded-lg px-3 py-2 text-[12px]";
const STATUS: Record<string, string> = {
  draft: "Draft", pending_approval: "Needs admin approval (above band)", approved: "Approved", sent: "Sent",
  accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired",
};

export function OfferCard({ candidateId, offers, defaultTitle, appUrl }: {
  candidateId: string; offers: OfferRow[]; defaultTitle: string; appUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ designation: defaultTitle, fixed: 0, variable: 0, bonus: 0, joiningDate: "", location: "", reportingTo: "", expiresInDays: 5 });
  const [editing, setEditing] = useState<{ id: string; html: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const run = (fn: () => Promise<{ error?: string } | { success: boolean } | { offer: OfferRow }>) =>
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) toast(res.error, "error");
      else router.refresh();
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">
          <FileSignature className="h-3.5 w-3.5" /> Offer
        </h2>
        {!open && (
          <button onClick={() => setOpen(true)} className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-accent">New offer</button>
        )}
      </div>

      {open && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[11px] text-dark-text-muted">Designation
            <input className={input} value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></label>
          <label className="text-[11px] text-dark-text-muted">Fixed (LPA)
            <input type="number" step="0.1" className={input} value={f.fixed || ""} onChange={(e) => setF({ ...f, fixed: Number(e.target.value) })} /></label>
          <label className="text-[11px] text-dark-text-muted">Variable (LPA)
            <input type="number" step="0.1" className={input} value={f.variable || ""} onChange={(e) => setF({ ...f, variable: Number(e.target.value) })} /></label>
          <label className="text-[11px] text-dark-text-muted">Joining bonus (L)
            <input type="number" step="0.1" className={input} value={f.bonus || ""} onChange={(e) => setF({ ...f, bonus: Number(e.target.value) })} /></label>
          <label className="text-[11px] text-dark-text-muted">Joining date
            <input type="date" className={input} value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} /></label>
          <label className="text-[11px] text-dark-text-muted">Location
            <input className={input} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
          <label className="text-[11px] text-dark-text-muted">Reporting to
            <input className={input} value={f.reportingTo} onChange={(e) => setF({ ...f, reportingTo: e.target.value })} /></label>
          <div className="col-span-2 flex gap-2">
            <button disabled={pending || !f.fixed || !f.designation}
              onClick={() => run(async () => { const r = await createOffer(candidateId, f); if (!("error" in r)) setOpen(false); return r; })}
              className="btn-primary rounded-lg px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">Create draft</button>
            <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-[12px] text-dark-text-muted">Cancel</button>
          </div>
        </div>
      )}

      {offers.length === 0 && !open && <p className="text-[12px] text-dark-text-muted">No offer yet.</p>}
      <div className="space-y-2">
        {offers.map((o) => {
          const total = (o.ctc.fixed || 0) + (o.ctc.variable || 0);
          return (
            <div key={o.id} className="row-item rounded-xl px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px]">
                  <span className="font-semibold text-dark-text">{o.designation}</span>
                  <span className="text-dark-text-muted"> · {total} LPA · {STATUS[o.status] || o.status}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {o.status === "pending_approval" && (
                    <button onClick={() => run(() => offerAction(o.id, "approve", candidateId))} className="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px]">Approve</button>
                  )}
                  {["draft", "approved", "pending_approval"].includes(o.status) && (
                    <button onClick={() => setEditing({ id: o.id, html: o.letter_html || "" })} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px]">Edit letter</button>
                  )}
                  {["draft", "approved"].includes(o.status) && (
                    <button onClick={() => run(() => offerAction(o.id, "send", candidateId))} className="btn-primary rounded-lg px-2 py-1 text-[11px] text-white">Send</button>
                  )}
                  {o.status === "sent" && (
                    <button onClick={() => navigator.clipboard?.writeText(`${appUrl}/offer/${o.token}`)} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px]">Copy link</button>
                  )}
                  {["draft", "approved", "sent", "pending_approval"].includes(o.status) && (
                    <button onClick={() => run(() => offerAction(o.id, "withdraw", candidateId))} className="rounded-lg px-2 py-1 text-[11px] text-dark-text-muted">Withdraw</button>
                  )}
                </div>
              </div>
              {o.status === "accepted" && (
                <p className="mt-1 text-[11px] text-emerald-400">Signed by {o.signature_name} on {o.responded_at && new Date(o.responded_at).toLocaleString()}</p>
              )}
              {o.status === "declined" && <p className="mt-1 text-[11px] text-amber-400">Declined: {o.decline_reason || "no reason given"}</p>}
              {editing?.id === o.id && (
                <div className="mt-2 space-y-2">
                  <textarea rows={10} className={input + " font-mono"} value={editing.html} onChange={(e) => setEditing({ id: o.id, html: e.target.value })} />
                  <div className="flex gap-2">
                    <button onClick={() => run(async () => { const r = await updateOfferLetter(o.id, editing.html, candidateId); setEditing(null); return r; })}
                      className="btn-primary rounded-lg px-3 py-1.5 text-[11px] text-white">Save letter</button>
                    <button onClick={() => setEditing(null)} className="text-[11px] text-dark-text-muted">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
