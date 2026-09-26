"use client";

import { useState, useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { callNoShow } from "@/app/actions/interviews";

export function NoShowButton({ interviewId }: { interviewId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <button disabled={pending} title="Neha phones the candidate right now to check they're joining"
        onClick={() => startTransition(async () => { const r = await callNoShow(interviewId); setMsg(r.error || "Neha is calling"); })}
        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50">
        <PhoneCall className="h-3 w-3" /> Candidate hasn&apos;t joined
      </button>
      {msg && <span className="text-[10px] text-dark-text-muted">{msg}</span>}
    </span>
  );
}
