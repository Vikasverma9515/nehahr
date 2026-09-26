import { signedBackendUrl } from "@/app/lib/backend";
import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/ui/page-header";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { ExtractedData } from "@/app/components/extracted-data";
import { CallTranscript } from "@/app/components/call-transcript";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: call } = await supabase.from("calls").select("*, candidates(name, phone, email)").eq("id", id).single();
  if (!call) notFound();
  const candidate = call.candidates as unknown as { name: string; phone: string; email: string } | null;
  const extracted = (call.extracted_data || {}) as Record<string, unknown>;
  const scorecard = extracted._scorecard as { score?: number; reason?: string; qualified?: boolean } | undefined;
  const visibleExtracted = Object.fromEntries(Object.entries(extracted).filter(([k]) => !k.startsWith("_")));
  const latency = (call.latency_metrics || []) as { total_ms?: number; eou_ms?: number; llm_ttft_ms?: number; tts_ttfb_ms?: number }[];
  const pipeline = (call.pipeline || null) as { stt?: string; llm?: string; tts?: string; avatar?: boolean; latency?: { p50_ms?: number; p95_ms?: number } } | null;

  return (
    <>
      <PageHeader title={`${call.call_type.replace(/_/g, " ")} Call`} description={candidate?.name || "Unknown candidate"} />
      <div className="mb-6 flex items-center gap-4">
        <Badge>{call.status}</Badge>
        {call.is_test && <Badge>Playground test</Badge>}
        {call.channel && call.channel !== "phone" && <Badge>{call.channel}</Badge>}
        {call.duration_seconds && <span className="text-[12px] font-medium text-dark-text-muted">Duration: {Math.floor(call.duration_seconds/60)}m {call.duration_seconds%60}s</span>}
        <span className="text-[12px] text-dark-text-muted">{new Date(call.created_at).toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {call.recording_url && (
            <Card><h2 className="mb-4 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Recording</h2>
              <audio controls className="w-full" src={signedBackendUrl(`/api/calls/${id}/recording`, 6 * 3600)}>Your browser does not support audio.</audio>
            </Card>
          )}
          <Card>
            <h2 className="mb-4 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Transcript</h2>
            <CallTranscript transcript={call.transcript as string | null} />
          </Card>
          {call.ai_summary && (
            <Card><h2 className="mb-4 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">AI Summary</h2>
              <p className="text-[13px] leading-relaxed text-dark-text-secondary">{call.ai_summary}</p>
            </Card>
          )}
        </div>
        <div>
          <Card>
            <h2 className="mb-4 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Extracted Data</h2>
            <ExtractedData data={visibleExtracted} />
          </Card>
          {scorecard && (
            <Card className="mt-6">
              <h2 className="mb-2 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Score preview</h2>
              <p className="font-display text-[32px] text-dark-text">{scorecard.score ?? "–"}<span className="text-[14px] text-dark-text-muted">/100</span></p>
              {scorecard.reason && <p className="mt-2 text-[12px] text-dark-text-secondary">{scorecard.reason}</p>}
              <p className="mt-2 text-[11px] text-dark-text-muted">Test session: the candidate&apos;s real score was not changed.</p>
            </Card>
          )}
          {latency.length > 0 && (
            <Card className="mt-6">
              <h2 className="mb-2 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Voice latency</h2>
              {pipeline?.latency && (
                <p className="text-[12px] text-dark-text-secondary">
                  p50 {pipeline.latency.p50_ms} ms · p95 {pipeline.latency.p95_ms} ms over {latency.length} turns
                </p>
              )}
              <div className="mt-3 flex h-16 items-end gap-1">
                {latency.map((r, i) => (
                  <div key={i} title={`Turn ${i + 1}: ${r.total_ms} ms`}
                    className={(r.total_ms ?? 0) > 800 ? "w-2 rounded-sm bg-amber-400/80" : "w-2 rounded-sm bg-emerald-400/80"}
                    style={{ height: `${Math.min(100, ((r.total_ms ?? 0) / 1600) * 100)}%` }} />
                ))}
              </div>
              {pipeline && (
                <p className="mt-3 text-[11px] text-dark-text-muted">
                  {[pipeline.stt, pipeline.llm, pipeline.tts].filter(Boolean).join(" · ")}{pipeline.avatar ? " · Tavus" : ""}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
