"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { rescoreCandidate } from "@/app/actions/candidates";
import { useToast } from "@/app/components/ui/toast";

export function RescoreButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return (
    <button
      title="Score again with the job's current rubric and hard requirements"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await rescoreCandidate(candidateId);
        if ("error" in r && r.error) {
          toast(r.error, "error");
        } else {
          toast(`Rescored: ${"score" in r ? r.score : "–"}/100`);
        }
      })}
      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50"
    >
      <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} /> Re-score
    </button>
  );
}
