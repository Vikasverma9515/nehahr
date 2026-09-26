"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { saveOrgPolicy, type OrgPolicy } from "@/app/actions/org-settings";

const input = "mt-1 block w-full rounded-lg px-3 py-2 text-[12px]";

export function ComplianceSection({ policy }: { policy: OrgPolicy }) {
  const [p, setP] = useState(policy);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hours = p.calling_hours;

  return (
    <div>
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-dark-text"><ShieldCheck className="h-4 w-4" /> Calling hours and data</h2>
      <p className="mt-0.5 text-[11px] text-dark-text-muted">
        Automatic calls wait for these hours. Every call opens by saying Neha is an AI and the call is recorded.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-[11px] text-dark-text-muted">From
          <input type="number" min={0} max={23} className={input} value={hours.start}
            onChange={(e) => setP({ ...p, calling_hours: { ...hours, start: Number(e.target.value) } })} /></label>
        <label className="text-[11px] text-dark-text-muted">Until
          <input type="number" min={1} max={24} className={input} value={hours.end}
            onChange={(e) => setP({ ...p, calling_hours: { ...hours, end: Number(e.target.value) } })} /></label>
        <label className="text-[11px] text-dark-text-muted">Time zone
          <input className={input} value={hours.timezone}
            onChange={(e) => setP({ ...p, calling_hours: { ...hours, timezone: e.target.value } })} /></label>
        <label className="flex items-end gap-2 pb-2 text-[12px] text-dark-text-secondary">
          <input type="checkbox" checked={hours.weekends}
            onChange={(e) => setP({ ...p, calling_hours: { ...hours, weekends: e.target.checked } })} /> Weekends
        </label>
        <label className="col-span-2 text-[11px] text-dark-text-muted">Erase transcripts, recordings and messages after (days)
          <input type="number" min={30} className={input} placeholder="Keep forever" value={p.retention_days ?? ""}
            onChange={(e) => setP({ ...p, retention_days: e.target.value ? Number(e.target.value) : null })} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={pending} onClick={() => startTransition(async () => {
          const r = await saveOrgPolicy(p);
          setMsg(r.error || "Saved");
        })} className="btn-primary rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">Save</button>
        {msg && <span className="text-[12px] text-dark-text-secondary">{msg}</span>}
      </div>
      <p className="mt-3 text-[11px] text-dark-text-muted">
        Deleting a candidate erases all their calls, interviews, messages and resume, and is recorded in the audit log.
      </p>
    </div>
  );
}
