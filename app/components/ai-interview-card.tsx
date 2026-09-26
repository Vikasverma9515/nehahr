"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, Video, X } from "lucide-react";
import { cancelAiInterview, inviteToAiInterview } from "@/app/actions/ai-interviews";

export type AiInterviewRow = {
  id: string;
  status: string;
  expires_at: string;
  invited_at: string;
  score: number | null;
  summary: string | null;
  call_id: string | null;
  token: string;
};

export function AiInterviewCard({
  candidateId,
  rows,
  appUrl,
}: {
  candidateId: string;
  rows: AiInterviewRow[];
  appUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function invite() {
    setMessage(null);
    startTransition(async () => {
      const res = await inviteToAiInterview(candidateId);
      if ("error" in res && res.error) setMessage(res.error);
      else if ("link" in res) {
        await navigator.clipboard?.writeText(res.link).catch(() => null);
        setMessage(res.emailed ? "Invite emailed. Link copied." : "Link copied (no email sent: connect the HR sender in Settings).");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">AI video interview</h2>
        <button onClick={invite} disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-white/[0.08] disabled:opacity-50">
          <Video className="h-3.5 w-3.5" /> {pending ? "Sending..." : "Send invite"}
        </button>
      </div>
      <p className="text-[12px] text-dark-text-muted">
        A 15-minute first round with Neha on video. The candidate takes it from a link, any time before it expires.
      </p>
      {message && <p className="mt-2 text-[12px] text-dark-text-secondary">{message}</p>}
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="row-item rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px]">
                <span className="font-semibold capitalize text-dark-text">{r.status.replace("_", " ")}</span>
                <span className="text-dark-text-muted"> · sent {new Date(r.invited_at).toLocaleDateString()}</span>
                {r.score !== null && <span className="ml-2 font-semibold text-dark-text">{r.score}/100</span>}
              </div>
              <div className="flex items-center gap-1">
                {r.status === "invited" && (
                  <button title="Copy link" onClick={() => navigator.clipboard?.writeText(`${appUrl}/interview/${r.token}`)}
                    className="rounded-lg p-1.5 text-dark-text-muted hover:bg-white/[0.06]"><Copy className="h-3.5 w-3.5" /></button>
                )}
                {r.status === "in_progress" && (
                  <Link href={`/dashboard/ai-interviews/${r.id}/watch`} title="Watch live"
                    className="inline-flex items-center gap-1 rounded-lg bg-accent/20 px-2 py-1 text-[11px] text-dark-text"><Eye className="h-3 w-3" /> Watch live</Link>
                )}
                {r.call_id && r.status === "completed" && (
                  <Link href={`/dashboard/calls/${r.call_id}`} className="text-[11px] text-accent hover:underline">Transcript</Link>
                )}
                {(r.status === "invited" || r.status === "in_progress") && (
                  <button title="Cancel" onClick={() => startTransition(async () => { await cancelAiInterview(r.id, candidateId); router.refresh(); })}
                    className="rounded-lg p-1.5 text-dark-text-muted hover:bg-white/[0.06]"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
            {r.summary && <p className="mt-1.5 text-[12px] leading-relaxed text-dark-text-secondary">{r.summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
