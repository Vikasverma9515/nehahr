"use client";

import { useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { callNoShow } from "@/app/actions/interviews";
import { useToast } from "@/app/components/ui/toast";

export function NoShowButton({ interviewId }: { interviewId: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return (
    <button disabled={pending} title="Neha phones the candidate right now to check they're joining"
      onClick={() => startTransition(async () => {
        const r = await callNoShow(interviewId);
        if (r.error) toast(r.error, "error");
        else toast("Neha is calling");
      })}
      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50">
      <PhoneCall className="h-3 w-3" /> Candidate hasn&apos;t joined
    </button>
  );
}
