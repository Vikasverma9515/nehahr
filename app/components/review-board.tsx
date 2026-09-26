"use client";

import { useState, useTransition } from "react";
import { submitDecision, type ReviewCandidate, type ReviewPage } from "@/app/actions/reviews";

const ctc = (v: Record<string, number> | null) => {
  if (!v) return "–";
  if (v.min != null && v.max != null) return `${v.min}–${v.max} LPA`;
  if (v.fixed != null) return `${v.fixed + (v.variable || 0)} LPA`;
  return `${v.min ?? v.max} LPA`;
};

export function ReviewBoard({ token, page }: { token: string; page: ReviewPage }) {
  const done = page.candidates.filter((c) => c.decision).length;
  return (
    <div className="space-y-5">
      <div className="card-glass rounded-2xl p-6">
        <h1 className="font-display text-[24px]">
          Hi {(page.reviewer_name || "there").split(" ")[0]}, {page.candidates.length} candidates to review
        </h1>
        {page.message && <p className="mt-2 text-[14px] text-dark-text-secondary">{page.message}</p>}
        <p className="mt-2 text-[12px] text-dark-text-muted">
          Advance shortlists them for interviews. Reject closes them politely. {done} of {page.candidates.length} decided.
        </p>
      </div>
      {page.candidates.map((c) => <CandidateBrief key={c.id} token={token} c={c} />)}
    </div>
  );
}

function CandidateBrief({ token, c }: { token: string; c: ReviewCandidate }) {
  const [decision, setDecision] = useState(c.decision?.decision || null);
  const [note, setNote] = useState(c.decision?.note || "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (d: string) => startTransition(async () => {
    setError(null);
    const res = await submitDecision(token, c.id, d, note);
    if (res.error) setError(res.error);
    else setDecision(d);
  });

  const facts: [string, string][] = [
    ["Now", [c.current_title, c.current_company].filter(Boolean).join(" at ") || "–"],
    ["Experience", c.experience_years != null ? `${c.experience_years} yrs` : "–"],
    ["Location", c.current_location || "–"],
    ["Notice", c.notice_period_days != null ? `${c.notice_period_days} days` : "–"],
    ["Current CTC", ctc(c.current_ctc)],
    ["Expected", ctc(c.expected_ctc)],
  ];

  return (
    <div className="card-glass rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold">{c.name}</h2>
          {c.skills?.length ? <p className="mt-1 text-[12px] text-dark-text-muted">{c.skills.slice(0, 10).join(" · ")}</p> : null}
        </div>
        <div className="flex gap-4 text-center">
          <Score label="Screening" value={c.score} />
          <Score label="Resume" value={c.match_score} />
          {c.ai_interview && <Score label="Interview" value={c.ai_interview.score} />}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-dark-text-muted">{k}</dt>
            <dd className="text-[13px] text-dark-text">{v}</dd>
          </div>
        ))}
      </dl>
      {c.screening_summary && (
        <p className="mt-4 text-[13px] leading-relaxed text-dark-text-secondary">
          <span className="font-semibold text-dark-text">What Neha heard: </span>{c.screening_summary}
        </p>
      )}
      {c.ai_interview?.summary && (
        <p className="mt-2 text-[13px] leading-relaxed text-dark-text-secondary">
          <span className="font-semibold text-dark-text">Video interview: </span>{c.ai_interview.summary}
        </p>
      )}
      {(c.match_reasons?.strengths?.length || c.match_reasons?.gaps?.length) ? (
        <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
          <div>{(c.match_reasons?.strengths || []).map((s) => <p key={s} className="text-emerald-400">+ {s}</p>)}</div>
          <div>{(c.match_reasons?.gaps || []).map((s) => <p key={s} className="text-amber-400">– {s}</p>)}</div>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the recruiter (optional)"
          className="min-w-[220px] flex-1 rounded-xl px-3 py-2 text-[13px]" />
        {[["advance", "Advance", "bg-emerald-600/80"], ["maybe", "Maybe", "bg-white/[0.08]"], ["reject", "Reject", "bg-red-500/70"]].map(([d, label, cls]) => (
          <button key={d} onClick={() => decide(d)} disabled={pending}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 ${cls} ${decision === d ? "ring-2 ring-white/70" : ""}`}>
            {label}
          </button>
        ))}
      </div>
      {decision && <p className="mt-2 text-[12px] text-dark-text-muted">Saved: {decision}. You can change it any time.</p>}
      {error && <p className="mt-2 text-[12px] text-amber-400">{error}</p>}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-dark-text-muted">{label}</p>
      <p className="font-display text-[22px]">{value ?? "–"}</p>
    </div>
  );
}
