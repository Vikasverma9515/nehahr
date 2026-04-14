"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

type Interviewer = {
  id: string;
  name: string;
  email: string;
};

export function JobInterviewerPicker({
  jobId,
  currentInterviewerId,
  interviewers,
}: {
  jobId: string;
  currentInterviewerId: string | null;
  interviewers: Interviewer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentInterviewerId || "");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("jobs")
        .update({ default_interviewer_id: selected || null })
        .eq("id", jobId);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg px-3 py-1.5 text-[12px]"
      >
        <option value="">None</option>
        {interviewers.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={pending || selected === (currentInterviewerId || "")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-white/[0.08] disabled:opacity-40"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : saved ? (
          <Check className="h-3 w-3" />
        ) : null}
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
