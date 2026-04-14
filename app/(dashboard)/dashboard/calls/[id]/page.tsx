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

  return (
    <>
      <PageHeader title={`${call.call_type.replace(/_/g, " ")} Call`} description={candidate?.name || "Unknown candidate"} />
      <div className="mb-6 flex items-center gap-4">
        <Badge>{call.status}</Badge>
        {call.duration_seconds && <span className="text-[12px] font-medium text-dark-text-muted">Duration: {Math.floor(call.duration_seconds/60)}m {call.duration_seconds%60}s</span>}
        <span className="text-[12px] text-dark-text-muted">{new Date(call.created_at).toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {call.recording_url && (
            <Card><h2 className="mb-4 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">Recording</h2>
              <audio controls className="w-full" src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/calls/${id}/recording`}>Your browser does not support audio.</audio>
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
            <ExtractedData data={call.extracted_data as Record<string, unknown> | null} />
          </Card>
        </div>
      </div>
    </>
  );
}
