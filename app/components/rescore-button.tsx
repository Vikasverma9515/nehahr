"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { rescoreCandidate } from "@/app/actions/candidates";

export function RescoreButton({ candidateId }: { candidateId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        title="Score again with the job's current rubric and hard requirements"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await rescoreCandidate(candidateId);
          setMsg("error" in r && r.error ? r.error : `Now ${"score" in r ? r.score : "–"}/100`);
        })}
        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} /> Re-score
      </button>
      {msg && <span className="text-[10px] text-dark-text-muted">{msg}</span>}
    </span>
  );
}
