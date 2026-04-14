"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { triggerCall } from "@/app/actions/calls";

export function CallTriggerButton({
  candidateId,
  callType,
  label,
}: {
  candidateId: string;
  callType: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    const res = await triggerCall(candidateId, callType);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        <Phone className="h-3.5 w-3.5" />
        {loading ? "Calling..." : label}
      </button>
      {result?.success && (
        <span className="text-[12px] text-success">Call initiated</span>
      )}
      {result?.error && (
        <span className="text-[12px] text-danger">{result.error}</span>
      )}
    </div>
  );
}
