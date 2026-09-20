"use client";

import { useState, useTransition } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { shortlistCandidate, rejectCandidate } from "@/app/actions/candidates";

export function ShortlistButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await shortlistCandidate(candidateId);
      if (res.success) setDone(true);
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text-secondary">
        <Check className="h-4 w-4" />
        Shortlisted
      </span>
    );
  }

  return (
    <button
      data-ai="shortlist-candidate"
      title="Move this candidate to the shortlist"
      onClick={handleClick}
      disabled={pending}
      className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
    >
      <Check className="h-3.5 w-3.5" />
      {pending ? "Shortlisting..." : "Shortlist"}
    </button>
  );
}

export function RejectButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    startTransition(async () => {
      await rejectCandidate(candidateId);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-dark-text-secondary">Reject this candidate?</span>
        <button
          data-ai="confirm-reject-candidate"
          onClick={handleClick}
          disabled={pending}
          className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50"
        >
          {pending ? "Rejecting..." : "Yes, reject"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] font-medium text-dark-text-muted hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      data-ai="reject-candidate"
      title="Reject this candidate (asks to confirm first)"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text-secondary hover:bg-white/[0.08]"
    >
      <X className="h-3.5 w-3.5" />
      Reject
    </button>
  );
}

export function OverrideShortlistButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await shortlistCandidate(candidateId);
      if (res.success) setDone(true);
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text-secondary">
        <Check className="h-4 w-4" />
        Shortlisted (HR override)
      </span>
    );
  }

  return (
    <button
      data-ai="shortlist-anyway-override"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50"
      title="Override AI's rejection and shortlist this candidate"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {pending ? "Overriding..." : "Shortlist Anyway (HR Override)"}
    </button>
  );
}
