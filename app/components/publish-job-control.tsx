"use client";

import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { setJobPublishing } from "@/app/actions/careers";
import { useToast } from "@/app/components/ui/toast";

export function PublishJobControl({ jobId, published, autoScreen, careersUrl }: {
  jobId: string; published: boolean; autoScreen: number | null; careersUrl: string | null;
}) {
  const [on, setOn] = useState(published);
  const [threshold, setThreshold] = useState<string>(autoScreen != null ? String(autoScreen) : "");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const save = (nextOn: boolean, nextThreshold: string) => startTransition(async () => {
    const t = nextThreshold.trim() === "" ? null : Math.max(0, Math.min(100, Number(nextThreshold)));
    const res = await setJobPublishing(jobId, nextOn, t);
    if (res.error) toast(res.error, "error");
    else toast(nextOn ? "Published on your careers page" : "Hidden from the careers page");
  });

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3">
      <label className="flex items-center gap-2 text-[12px] font-semibold text-dark-text-secondary">
        <input type="checkbox" checked={on} disabled={pending} onChange={(e) => { setOn(e.target.checked); save(e.target.checked, threshold); }} />
        <Globe className="h-3.5 w-3.5" /> Show on careers page
      </label>
      <label className="flex items-center gap-2 text-[12px] text-dark-text-secondary">
        Auto-call applicants with resume match ≥
        <input type="number" min={0} max={100} value={threshold} placeholder="off"
          onChange={(e) => setThreshold(e.target.value)} onBlur={() => save(on, threshold)}
          className="w-16 rounded-lg px-2 py-1 text-[12px]" />
      </label>
      {on && careersUrl && (
        <button onClick={() => navigator.clipboard?.writeText(careersUrl)} className="text-[12px] text-accent hover:underline">Copy job link</button>
      )}
    </div>
  );
}
