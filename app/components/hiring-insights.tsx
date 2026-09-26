import { Card } from "@/app/components/ui/card";
import { createClient } from "@/app/lib/supabase/server";

const ADVANCED = new Set(["shortlisted", "scheduling", "scheduled", "interviewing", "offer", "pre_joining", "joined"]);
const HIRED = new Set(["pre_joining", "joined"]);
const SOURCE_LABEL: Record<string, string> = {
  manual: "Added by hand", csv: "CSV import", resume: "Resume upload", careers_page: "Careers page",
  referral: "Referral", api: "API",
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sinceIso(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** Time to hire, source quality and voice quality (last 30 days for voice). */
export async function HiringInsights() {
  const supabase = await createClient();
  const [cands, calls] = await Promise.all([
    supabase.from("candidates").select("source, stage, created_at, offer_accepted_at"),
    supabase.from("calls").select("runtime, channel, status, pipeline, answered_by, created_at")
      .gte("created_at", sinceIso(30)),
  ]);
  const candidates = cands.data || [];
  const voiceCalls = (calls.data || []).filter((c) => c.runtime === "livekit");

  const daysToHire = candidates
    .filter((c) => c.offer_accepted_at)
    .map((c) => (new Date(c.offer_accepted_at).getTime() - new Date(c.created_at).getTime()) / 86400_000);
  const medianHire = median(daysToHire);

  const bySource = new Map<string, { total: number; advanced: number; hired: number }>();
  for (const c of candidates) {
    const key = c.source || "manual";
    const row = bySource.get(key) || { total: 0, advanced: 0, hired: 0 };
    row.total++;
    if (ADVANCED.has(c.stage)) row.advanced++;
    if (HIRED.has(c.stage)) row.hired++;
    bySource.set(key, row);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1].total - a[1].total);

  const p50s = voiceCalls.map((c) => c.pipeline?.latency?.p50_ms).filter((x): x is number => typeof x === "number");
  const p95s = voiceCalls.map((c) => c.pipeline?.latency?.p95_ms).filter((x): x is number => typeof x === "number");
  const p50 = median(p50s);
  const p95 = median(p95s);
  const voicemail = voiceCalls.filter((c) => c.answered_by === "machine" || c.status === "voicemail").length;
  const answered = voiceCalls.filter((c) => c.answered_by === "human" || c.status === "completed").length;

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.1em] text-dark-text-muted">Time to hire (median)</p>
        <p className="font-display mt-3 text-[40px] leading-none text-dark-text">
          {medianHire == null ? "–" : `${medianHire.toFixed(1)}`}<span className="text-[16px] text-dark-text-muted"> days</span>
        </p>
        <p className="mt-2 text-[12px] text-dark-text-secondary">From added to offer accepted, across {daysToHire.length} hires.</p>
      </Card>

      <Card>
        <p className="text-[11px] uppercase tracking-[0.1em] text-dark-text-muted">Voice latency, last 30 days</p>
        <div className="mt-3 flex items-end gap-6">
          <div>
            <p className="font-display text-[40px] leading-none text-dark-text">{p50 == null ? "–" : Math.round(p50)}<span className="text-[16px] text-dark-text-muted"> ms</span></p>
            <p className="mt-1 text-[11px] text-dark-text-muted">typical turn (p50)</p>
          </div>
          <div>
            <p className="font-display text-[24px] leading-none text-dark-text">{p95 == null ? "–" : Math.round(p95)} ms</p>
            <p className="mt-1 text-[11px] text-dark-text-muted">slow turns (p95)</p>
          </div>
        </div>
        {p50 != null && (
          <p className="mt-2 text-[12px] text-dark-text-secondary">
            <span className={p50 <= 800 ? "text-emerald-400" : "text-amber-400"}>●</span>{" "}
            {p50 <= 800 ? "On target" : "Above target"} (800 ms) over {p50s.length} LiveKit calls
          </p>
        )}
      </Card>

      <Card>
        <p className="text-[11px] uppercase tracking-[0.1em] text-dark-text-muted">Calls on the new agent, last 30 days</p>
        <dl className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex justify-between"><dt className="text-dark-text-secondary">Calls</dt><dd className="text-dark-text">{voiceCalls.length}</dd></div>
          <div className="flex justify-between"><dt className="text-dark-text-secondary">Reached a person</dt><dd className="text-dark-text">{pct(answered, voiceCalls.length)}</dd></div>
          <div className="flex justify-between"><dt className="text-dark-text-secondary">Voicemail</dt><dd className="text-dark-text">{pct(voicemail, voiceCalls.length)}</dd></div>
          <div className="flex justify-between"><dt className="text-dark-text-secondary">Video room / Meet</dt>
            <dd className="text-dark-text">{voiceCalls.filter((c) => c.channel === "room").length} / {voiceCalls.filter((c) => c.channel === "meet").length}</dd></div>
        </dl>
      </Card>

      <Card className="lg:col-span-3">
        <h2 className="text-[13px] font-semibold text-dark-text">Where good candidates come from</h2>
        <p className="mt-0.5 text-[11px] text-dark-text-muted">Shortlisted or later, and hired (offer accepted or joined), by source.</p>
        <table className="mt-4 w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-dark-text-muted">
            <tr><th className="py-1.5 font-normal">Source</th><th className="text-right font-normal">Candidates</th>
              <th className="text-right font-normal">Shortlisted</th><th className="text-right font-normal">Hired</th></tr>
          </thead>
          <tbody>
            {sources.length === 0 && <tr><td colSpan={4} className="py-3 text-dark-text-muted">No candidates yet.</td></tr>}
            {sources.map(([src, r]) => (
              <tr key={src} className="border-t border-white/[0.05] text-dark-text-secondary">
                <td className="py-2 text-dark-text">{SOURCE_LABEL[src] || src}</td>
                <td className="text-right">{r.total}</td>
                <td className="text-right">{r.advanced} <span className="text-dark-text-muted">({pct(r.advanced, r.total)})</span></td>
                <td className="text-right">{r.hired} <span className="text-dark-text-muted">({pct(r.hired, r.total)})</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
