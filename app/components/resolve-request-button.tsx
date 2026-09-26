"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { resolveCandidateRequest } from "@/app/actions/requests";

export function ResolveRequestButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await resolveCandidateRequest(id); router.refresh(); })}
      title="Mark done"
      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] text-dark-text-secondary hover:bg-white/[0.08] disabled:opacity-50"
    >
      <Check className="h-3 w-3" /> Done
    </button>
  );
}
