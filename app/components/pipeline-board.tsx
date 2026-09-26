"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { moveCandidateStage } from "@/app/actions/candidates";

type Card = { id: string; name: string; stage: string; score: number | null; match_score?: number | null };

// Columns recruiters move people between by hand. Neha's own in-flight
// stages (screening, scheduling) show in the nearest column.
const COLUMNS: { key: string; label: string; includes: string[] }[] = [
  { key: "new", label: "New", includes: ["new", "screening"] },
  { key: "screened", label: "Screened", includes: ["screened"] },
  { key: "shortlisted", label: "Shortlisted", includes: ["shortlisted", "scheduling"] },
  { key: "interviewing", label: "Interviewing", includes: ["scheduled", "interviewing", "no_show"] },
  { key: "offer", label: "Offer", includes: ["offer"] },
  { key: "joined", label: "Joining", includes: ["pre_joining", "joined"] },
  { key: "rejected", label: "Closed", includes: ["rejected", "withdrawn"] },
];

export function PipelineBoard({ candidates }: { candidates: Card[] }) {
  const [items, setItems] = useState(candidates);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function drop(column: string) {
    const id = dragging;
    setOver(null);
    setDragging(null);
    if (!id) return;
    const card = items.find((c) => c.id === id);
    const col = COLUMNS.find((c) => c.key === column)!;
    if (!card || col.includes.includes(card.stage)) return;
    const previous = items;
    setItems(items.map((c) => (c.id === id ? { ...c, stage: column } : c)));
    startTransition(async () => {
      const r = await moveCandidateStage(id, column);
      if (r.error) {
        setItems(previous);
        setError(r.error);
      } else router.refresh();
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const cards = items.filter((c) => col.includes.includes(c.stage));
          return (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={() => drop(col.key)}
              className={`w-[220px] shrink-0 rounded-xl border p-2 transition ${over === col.key ? "border-accent/60 bg-accent/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-dark-text-muted">
                {col.label} <span className="font-normal">{cards.length}</span>
              </p>
              <div className="min-h-[60px] space-y-1.5">
                {cards.map((c) => (
                  <div key={c.id} draggable
                    onDragStart={() => setDragging(c.id)} onDragEnd={() => setDragging(null)}
                    className={`cursor-grab rounded-lg border border-white/[0.06] bg-[#12121a] px-3 py-2 active:cursor-grabbing ${dragging === c.id ? "opacity-40" : ""}`}>
                    <Link href={`/dashboard/candidates/${c.id}`} className="block truncate text-[12px] font-medium text-dark-text hover:underline">{c.name}</Link>
                    <p className="text-[10px] text-dark-text-muted">
                      {c.stage.replaceAll("_", " ")}
                      {c.score != null ? ` · ${Math.round(c.score)}` : ""}
                      {c.match_score != null ? ` · ${c.match_score}% match` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-dark-text-muted">Drag a card to move the candidate. Moving to Shortlisted lets you schedule; Closed rejects.</p>
    </div>
  );
}
