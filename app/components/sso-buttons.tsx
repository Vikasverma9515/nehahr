"use client";

import { useState, useTransition } from "react";
import { signInWithProvider } from "@/app/actions/auth";

export function SsoButtons() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const go = (p: "google" | "azure") => startTransition(async () => {
    const r = await signInWithProvider(p);
    if (r?.error) setError(r.error);
  });
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => go("google")}
        className="w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-dark-text hover:bg-white/[0.04] disabled:opacity-50">
        Continue with Google
      </button>
      <button type="button" disabled={pending} onClick={() => go("azure")}
        className="w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-dark-text hover:bg-white/[0.04] disabled:opacity-50">
        Continue with Microsoft
      </button>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex items-center gap-3 py-1 text-[11px] text-dark-text-muted">
        <span className="h-px flex-1 bg-white/[0.08]" /> or with email <span className="h-px flex-1 bg-white/[0.08]" />
      </div>
    </div>
  );
}
