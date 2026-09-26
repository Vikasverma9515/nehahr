"use client";

import { useTransition } from "react";
import { Link2 } from "lucide-react";
import { getPortalLink } from "@/app/actions/portal";
import { useToast } from "@/app/components/ui/toast";

export function PortalLinkButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return (
    <button
      title="Copy the candidate's self-serve link: status, self-booking, call me"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const res = await getPortalLink(candidateId);
        if ("link" in res) {
          await navigator.clipboard?.writeText(res.link).catch(() => null);
          toast("Candidate link copied to clipboard");
        } else {
          toast("Couldn't create link", "error");
        }
      })}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.04]"
    >
      <Link2 className="h-3.5 w-3.5" /> Candidate link
    </button>
  );
}
