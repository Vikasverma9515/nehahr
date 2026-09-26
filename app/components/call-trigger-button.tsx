"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { triggerCall } from "@/app/actions/calls";
import { useToast } from "@/app/components/ui/toast";

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
  const { toast } = useToast();

  async function handleClick() {
    setLoading(true);
    const res = await triggerCall(candidateId, callType);
    setLoading(false);
    if (res.success) {
      toast("Call initiated — Neha is dialing");
    } else {
      toast(res.error || "Failed to start call", "error");
    }
  }

  return (
    <button
      data-ai="start-ai-call"
      title="Have Neha phone the candidate now"
      onClick={handleClick}
      disabled={loading}
      className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
    >
      <Phone className="h-3.5 w-3.5" />
      {loading ? "Calling..." : label}
    </button>
  );
}
