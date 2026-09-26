"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { documentUrl, reviewDocument } from "@/app/actions/documents";

export type DocRow = { id: string; kind: string; file_name: string | null; status: string; note: string | null; uploaded_at: string };

export function DocumentsCard({ candidateId, docs }: { candidateId: string; docs: DocRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">
        <FileCheck2 className="h-3.5 w-3.5" /> Joining documents
      </h2>
      {docs.length === 0 && <p className="text-[12px] text-dark-text-muted">Nothing uploaded yet. The candidate uploads from their link.</p>}
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="row-item flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
            <div className="text-[12px]">
              <span className="font-semibold capitalize text-dark-text">{d.kind.replaceAll("_", " ")}</span>
              <span className="text-dark-text-muted"> · {d.status}</span>
            </div>
            <div className="flex gap-1.5">
              <button disabled={pending} onClick={() => startTransition(async () => {
                const r = await documentUrl(candidateId, d.id);
                if ("url" in r && r.url) window.open(r.url, "_blank", "noopener");
              })} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px]">View</button>
              {d.status !== "verified" && (
                <button disabled={pending} onClick={() => act(() => reviewDocument(d.id, candidateId, "verified"))}
                  className="rounded-lg bg-emerald-600/60 px-2 py-1 text-[11px] text-white">Verify</button>
              )}
              {d.status !== "rejected" && (
                <button disabled={pending} onClick={() => {
                  const note = prompt("Why? The candidate will see this.") || "";
                  act(() => reviewDocument(d.id, candidateId, "rejected", note));
                }} className="rounded-lg px-2 py-1 text-[11px] text-dark-text-muted">Reject</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
