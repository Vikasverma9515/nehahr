"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, LogOut } from "lucide-react";
import { recallNehaFromMeet, sendNehaToMeet, setNehaRole, type NehaRole } from "@/app/actions/interviews";

const ROLES: { value: NehaRole; label: string }[] = [
  { value: "none", label: "Neha: not joining" },
  { value: "notetaker", label: "Neha: silent notes" },
  { value: "co_interviewer", label: "Neha: co-interviewer" },
  { value: "lead", label: "Neha: leads the interview" },
];

const STATUS: Record<string, string> = {
  joining: "Neha is joining…",
  in_call: "Neha is in the call",
  left: "Neha left",
  failed: "Neha couldn't join",
};

export function NehaMeetControl({
  interviewId,
  candidateId,
  role,
  botStatus,
}: {
  interviewId: string;
  candidateId: string;
  role: NehaRole;
  botStatus: string | null;
}) {
  const [value, setValue] = useState<NehaRole>(role || "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const live = botStatus === "joining" || botStatus === "in_call";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        disabled={pending || live}
        title="Neha joins the Google Meet automatically 2 minutes before the start"
        onChange={(e) => {
          const next = e.target.value as NehaRole;
          setValue(next);
          startTransition(async () => {
            const res = await setNehaRole(interviewId, next, candidateId);
            if (res.error) setError(res.error);
          });
        }}
        className="rounded-lg px-2 py-1.5 text-[10px]"
      >
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      {value !== "none" && !live && (
        <button disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await sendNehaToMeet(interviewId, candidateId);
            if (res.error) setError(res.error);
            router.refresh();
          })}
          className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-[10px] font-semibold text-dark-text hover:bg-accent/25">
          <Bot className="h-3 w-3" /> Send Neha now
        </button>
      )}
      {live && (
        <button disabled={pending}
          onClick={() => startTransition(async () => { await recallNehaFromMeet(interviewId, candidateId); router.refresh(); })}
          className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-dark-text-secondary">
          <LogOut className="h-3 w-3" /> Ask Neha to leave
        </button>
      )}
      {botStatus && STATUS[botStatus] && <span className="text-[10px] text-dark-text-muted">{STATUS[botStatus]}</span>}
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
