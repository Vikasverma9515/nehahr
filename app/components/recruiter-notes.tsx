"use client";

import { useState, useTransition, useRef } from "react";
import { saveRecruiterNotes } from "@/app/actions/candidates";
import { useToast } from "@/app/components/ui/toast";

export function RecruiterNotes({ candidateId, initial }: { candidateId: string; initial: string | null }) {
  const [notes, setNotes] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const savedRef = useRef(initial ?? "");

  const save = () => {
    if (notes === savedRef.current) return;
    startTransition(async () => {
      const r = await saveRecruiterNotes(candidateId, notes);
      if (r.error) toast(r.error, "error");
      else { savedRef.current = notes; toast("Notes saved"); }
    });
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-dark-text-muted">Recruiter notes</p>
      <textarea
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        placeholder="Internal notes visible only to your team…"
        className="block w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[12px] text-dark-text placeholder:text-dark-text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 disabled:opacity-50"
        disabled={pending}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-dark-text-muted">Auto-saves on blur</span>
        <button
          onClick={save}
          disabled={pending || notes === savedRef.current}
          className="rounded-lg px-3 py-1 text-[11px] font-medium text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
