import { notFound } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { WatchRoom } from "@/app/components/interview-room/watch-room";

export default async function WatchInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ai_interviews")
    .select("id, status, candidates(name), jobs(title)")
    .eq("id", id)
    .single();
  if (!row) notFound();
  const cand = (Array.isArray(row.candidates) ? row.candidates[0] : row.candidates) as { name?: string } | null;
  const job = (Array.isArray(row.jobs) ? row.jobs[0] : row.jobs) as { title?: string } | null;

  return (
    <div>
      <PageHeader
        title={`Live: ${cand?.name || "Candidate"}`}
        description={`AI video interview${job?.title ? ` for ${job.title}` : ""}. You join muted; the candidate can't see you until you take over.`}
      />
      <WatchRoom interviewId={row.id} status={row.status} />
    </div>
  );
}
