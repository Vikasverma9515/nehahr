"use client";

import { useState, useTransition } from "react";
import { Share2, X } from "lucide-react";
import { createReviewLink } from "@/app/actions/reviews";

export function ShareReviewButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const share = () => startTransition(async () => {
    const res = await createReviewLink(jobId, name, email, message);
    if ("error" in res && res.error) return setResult(res.error);
    if ("link" in res) {
      await navigator.clipboard?.writeText(res.link).catch(() => null);
      setResult(`${res.count} candidates shared${res.emailed ? `, emailed to ${email}` : ""}. Link copied.`);
    }
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.04]">
        <Share2 className="h-3.5 w-3.5" /> Share with hiring manager
      </button>
    );
  }
  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-dark-text">Share screened candidates</p>
        <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4 text-dark-text-muted" /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Manager's name" className="block w-full rounded-lg px-3 py-2 text-[13px]" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Manager's email (optional)" className="block w-full rounded-lg px-3 py-2 text-[13px]" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Note (optional)" className="block w-full rounded-lg px-3 py-2 text-[13px]" />
      <button onClick={share} disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
        {pending ? "Sharing..." : "Create link"}
      </button>
      {result && <p className="text-[12px] text-dark-text-secondary">{result}</p>}
    </div>
  );
}
