"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  generateScreening,
  saveScreeningConfig,
  type MustHaves,
  type ScreeningConfig,
  type ScreeningQuestion,
} from "@/app/actions/screening";

const inputCls = "block w-full rounded-lg px-3 py-2 text-[13px]";
const labelCls = "block text-[10px] font-normal uppercase tracking-[0.1em] text-dark-text-muted";

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

export function ScreeningBuilder({ jobId, initial }: { jobId: string; initial: ScreeningConfig | null }) {
  const [questions, setQuestions] = useState<ScreeningQuestion[]>(initial?.questions || []);
  const [interviewQs, setInterviewQs] = useState<string[]>((initial?.interview_questions || []).map((q) => q.text));
  const [knockouts, setKnockouts] = useState<string[]>(initial?.knockouts || []);
  const [must, setMust] = useState<MustHaves>(initial?.must_haves || { allow_relocation: true });
  const [language, setLanguage] = useState(initial?.language || "auto");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function draft() {
    setMessage(null);
    startTransition(async () => {
      const res = await generateScreening(jobId);
      if (res.error || !res.draft) return setMessage(res.error || "No draft");
      setQuestions(res.draft.questions || []);
      setKnockouts(res.draft.knockouts || []);
      setInterviewQs((res.draft.interview_questions || []).map((q) => q.text));
      setMessage("Draft ready: edit anything, then save.");
    });
  }

  function save() {
    const config: ScreeningConfig = {
      questions: questions.filter((q) => q.text.trim()),
      interview_questions: interviewQs.filter((t) => t.trim()).map((text) => ({ text })),
      knockouts: knockouts.filter((k) => k.trim()),
      must_haves: must,
      language,
    };
    startTransition(async () => {
      const res = await saveScreeningConfig(jobId, config);
      setMessage(res.error || "Saved. Neha uses this on the next call.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-dark-text">Screening setup</h2>
          <p className="mt-0.5 text-[11px] text-dark-text-muted">
            What Neha asks on screening calls, what fails a candidate outright, and what she asks in video interviews.
          </p>
        </div>
        <button onClick={draft} disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-[12px] font-semibold text-dark-text disabled:opacity-50">
          <Sparkles className="h-3.5 w-3.5" /> {pending ? "Working..." : "Draft from job description"}
        </button>
      </div>

      <section>
        <p className={labelCls}>Role-fit questions (phone screening)</p>
        <div className="mt-2 space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input value={q.text} placeholder="Walk me through a service you scaled..." className={inputCls}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input value={q.what_good_looks_like || ""} placeholder="A good answer mentions..." className={inputCls}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, what_good_looks_like: e.target.value } : x)))} />
              <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label="Remove question"
                className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setQuestions([...questions, { text: "" }])}
            className="inline-flex items-center gap-1 text-[12px] text-accent"><Plus className="h-3 w-3" /> Add question</button>
        </div>
      </section>

      <section>
        <p className={labelCls}>Knock-out rules (spoken policy Neha checks)</p>
        <div className="mt-2 space-y-2">
          {knockouts.map((k, i) => (
            <div key={i} className="flex gap-2">
              <input value={k} className={inputCls} placeholder="Must be able to work from the Pune office 3 days a week"
                onChange={(e) => setKnockouts(knockouts.map((x, j) => (j === i ? e.target.value : x)))} />
              <button onClick={() => setKnockouts(knockouts.filter((_, j) => j !== i))} aria-label="Remove rule"
                className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setKnockouts([...knockouts, ""])}
            className="inline-flex items-center gap-1 text-[12px] text-accent"><Plus className="h-3 w-3" /> Add rule</button>
        </div>
      </section>

      <section>
        <p className={labelCls}>Hard requirements (checked automatically after the call)</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <label className="text-[12px] text-dark-text-secondary">Max notice (days)
            <input type="number" className={inputCls} value={must.max_notice_days ?? ""}
              onChange={(e) => setMust({ ...must, max_notice_days: numOrNull(e.target.value) })} />
          </label>
          <label className="text-[12px] text-dark-text-secondary">Min experience (years)
            <input type="number" step="0.5" className={inputCls} value={must.min_experience_years ?? ""}
              onChange={(e) => setMust({ ...must, min_experience_years: numOrNull(e.target.value) })} />
          </label>
          <label className="text-[12px] text-dark-text-secondary">Max expected CTC (LPA)
            <input type="number" className={inputCls} value={must.max_expected_ctc_lpa ?? ""}
              onChange={(e) => setMust({ ...must, max_expected_ctc_lpa: numOrNull(e.target.value) })} />
          </label>
          <label className="text-[12px] text-dark-text-secondary md:col-span-2">Allowed locations (comma separated)
            <input className={inputCls} value={(must.locations || []).join(", ")}
              onChange={(e) => setMust({ ...must, locations: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-[12px] text-dark-text-secondary">
            <input type="checkbox" checked={must.allow_relocation ?? true}
              onChange={(e) => setMust({ ...must, allow_relocation: e.target.checked })} /> Relocation is OK
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-dark-text-secondary">
          Work models accepted:
          {["office", "hybrid", "remote"].map((m) => (
            <label key={m} className="flex items-center gap-1 capitalize">
              <input type="checkbox" checked={(must.work_models || []).includes(m)}
                onChange={(e) => setMust({
                  ...must,
                  work_models: e.target.checked ? [...(must.work_models || []), m] : (must.work_models || []).filter((x) => x !== m),
                })} /> {m}
            </label>
          ))}
        </div>
      </section>

      <section>
        <p className={labelCls}>Video interview questions (AI first round)</p>
        <textarea rows={4} className={inputCls + " mt-2"} value={interviewQs.join("\n")}
          placeholder="One question per line"
          onChange={(e) => setInterviewQs(e.target.value.split("\n"))} />
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] text-dark-text-secondary">Call language
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="ml-2 rounded-lg px-2 py-1.5 text-[12px]">
            <option value="auto">Follow the candidate</option>
            <option value="en">English</option>
            <option value="hinglish">Hinglish</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
        <button onClick={save} disabled={pending}
          className="btn-primary rounded-xl px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-50">Save</button>
        {message && <span className="text-[12px] text-dark-text-secondary">{message}</span>}
      </section>
    </div>
  );
}
