"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Phone, UserX, Download, Loader2, X } from "lucide-react";
import { PersonAvatar } from "@/app/components/person-avatar";
import { useToast } from "@/app/components/ui/toast";
import Link from "next/link";

type Candidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stage: string;
  score: number | null;
  qualification_status?: string | null;
  needs_manual_scheduling?: boolean;
  scheduling_notes?: string | null;
  jobs: { title: string } | null;
};

type Action = "screen" | "reject" | "shortlist" | "export";

const ACTION_LABELS: Record<Action, string> = {
  screen: "Screen with Neha",
  shortlist: "Shortlist",
  reject: "Reject",
  export: "Export CSV",
};

export function BulkCandidateList({ candidates }: { candidates: Candidate[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const allSelected = candidates.length > 0 && selected.size === candidates.length;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));
  }

  function runAction(action: Action) {
    if (action === "export") {
      const ids = [...selected];
      const rows = candidates.filter((c) => ids.includes(c.id));
      const csv = [
        "Name,Stage,Score,Job",
        ...rows.map((c) => `"${c.name}","${c.stage}","${c.score ?? ""}","${(c.jobs as any)?.title ?? ""}"`),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidates.csv";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    startTransition(async () => {
      const ids = [...selected];
      try {
        const res = await fetch("/api/candidates/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });
        const data = await res.json();
        toast(data.message || `Done: ${data.count ?? ids.length} updated`);
        setSelected(new Set());
      } catch {
        toast("Something went wrong", "error");
      }
    });
  }

  return (
    <div>
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.10] bg-[#111116] px-4 py-2.5">
          <span className="text-[12px] font-semibold text-dark-text">{selected.size} selected</span>
          <div className="mx-2 h-4 w-px bg-white/[0.1]" />
          <button
            onClick={() => runAction("screen")}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-accent/25 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
            {ACTION_LABELS.screen}
          </button>
          <button
            onClick={() => runAction("shortlist")}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#7dd4a8]/10 px-3 py-1.5 text-[12px] font-medium text-[#7dd4a8] hover:bg-[#7dd4a8]/20 disabled:opacity-50"
          >
            Shortlist
          </button>
          <button
            onClick={() => runAction("reject")}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#e8908a]/10 px-3 py-1.5 text-[12px] font-medium text-[#e8908a] hover:bg-[#e8908a]/20 disabled:opacity-50"
          >
            <UserX className="h-3 w-3" /> Reject
          </button>
          <button
            onClick={() => runAction("export")}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.04]"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-dark-text-muted hover:text-dark-text">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2">
          <button onClick={toggleAll} className="shrink-0 text-dark-text-muted hover:text-dark-text">
            {allSelected
              ? <CheckSquare className="h-4 w-4 text-accent" />
              : <Square className="h-4 w-4" />}
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </span>
        </div>

        {candidates.map((c) => {
          const job = c.jobs as any;
          const isSelected = selected.has(c.id);
          const hint = getHint(c);
          return (
            <div
              key={c.id}
              className={`flex items-center gap-4 px-4 py-3 transition-colors ${isSelected ? "bg-accent/[0.04]" : "hover:bg-white/[0.03]"}`}
            >
              <button
                onClick={() => toggle(c.id)}
                className="shrink-0 text-dark-text-muted hover:text-dark-text"
              >
                {isSelected
                  ? <CheckSquare className="h-4 w-4 text-accent" />
                  : <Square className="h-4 w-4" />}
              </button>

              {c.score != null ? (
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={`${(c.score / 100) * 88} 88`} />
                  </svg>
                  <span className="text-[10px] font-bold text-dark-text">{c.score}</span>
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06]">
                  <span className="text-[9px] text-dark-text-muted">—</span>
                </div>
              )}

              <PersonAvatar name={c.name} size={36} className="hidden sm:block" />

              <Link href={`/dashboard/candidates/${c.id}`} className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-dark-text hover:underline">{c.name}</p>
                <p className="text-[11px] text-dark-text-muted">
                  {job?.title || "No role"}
                  {hint && <span className="text-dark-text-secondary"> · {hint}</span>}
                </p>
              </Link>

              {(c.email || c.phone) && (
                <div className="hidden shrink-0 flex-col items-end gap-0.5 lg:flex">
                  {c.email && <span className="text-[10px] text-dark-text-muted truncate max-w-[140px]">{c.email}</span>}
                  {c.phone && <span className="text-[10px] text-dark-text-muted">{c.phone}</span>}
                </div>
              )}

              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${stageColor(c.stage)}`}>
                {c.stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getHint(c: Candidate): string {
  if (c.stage === "screened" && c.qualification_status === "qualified") return "Ready to shortlist";
  if (c.needs_manual_scheduling) return c.scheduling_notes || "Needs manual scheduling";
  if (c.stage === "new") return "Awaiting screening";
  if (c.stage === "screening") return "Neha is screening";
  if (c.stage === "scheduling") return "Neha is scheduling";
  if (c.stage === "scheduled") return "Interview upcoming";
  if (c.stage === "interviewing") return "Awaiting feedback";
  if (c.stage === "offer") return "Offer stage";
  if (c.stage === "joined") return "Joined";
  if (c.stage === "rejected") return "Rejected";
  return "";
}

function stageColor(stage: string): string {
  const map: Record<string, string> = {
    new: "bg-white/[0.06] text-dark-text-muted",
    screening: "bg-accent/10 text-accent",
    screened: "bg-[#8ab4d9]/10 text-[#8ab4d9]",
    shortlisted: "bg-[#7dd4a8]/10 text-[#7dd4a8]",
    scheduling: "bg-accent/10 text-accent",
    scheduled: "bg-[#b4a0e8]/10 text-[#b4a0e8]",
    interviewing: "bg-[#b4a0e8]/10 text-[#b4a0e8]",
    offer: "bg-[#d4c27d]/10 text-[#d4c27d]",
    joined: "bg-[#7dd4a8]/10 text-[#7dd4a8]",
    rejected: "bg-[#e8908a]/10 text-[#e8908a]",
  };
  return map[stage] || "bg-white/[0.06] text-dark-text-muted";
}
