"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { getPortalLink } from "@/app/actions/portal";

export function PortalLinkButton({ candidateId }: { candidateId: string }) {
  const [label, setLabel] = useState("Candidate link");
  const [pending, startTransition] = useTransition();
  return (
    <button
      title="Copy the candidate's self-serve link: status, self-booking, call me"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const res = await getPortalLink(candidateId);
        if ("link" in res) {
          await navigator.clipboard?.writeText(res.link).catch(() => null);
          setLabel("Link copied");
        } else setLabel("Couldn't create link");
        setTimeout(() => setLabel("Candidate link"), 2500);
      })}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.04]"
    >
      <Link2 className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
