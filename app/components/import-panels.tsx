"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { importCsv, uploadResumes, type ImportSummary, type ResumeResult } from "@/app/actions/intake";

type Job = { id: string; title: string };

export function ImportPanels({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CsvPanel jobs={jobs} />
      <ResumePanel jobs={jobs} />
    </div>
  );
}

function JobSelect({ jobs, value, onChange }: { jobs: Job[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="block w-full rounded-lg px-3 py-2 text-[13px]">
      <option value="">No job yet</option>
      {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
    </select>
  );
}

function CsvPanel({ jobs }: { jobs: Job[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState(jobs[0]?.id || "");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(dryRun: boolean) {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (jobId) fd.append("job_id", jobId);
    fd.append("dry_run", dryRun ? "true" : "false");
    startTransition(async () => {
      const res = await importCsv(fd);
      if (res.error) setError(res.error);
      else if (res.summary) {
        setSummary(res.summary);
        if (!dryRun) setDone(res.summary.created);
      }
    });
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-dark-text"><FileSpreadsheet className="h-4 w-4" /> Spreadsheet (CSV)</h2>
      <p className="mt-1 text-[12px] text-dark-text-muted">
        Export from Excel, Google Sheets or a job board as CSV. Needs Name and Phone columns; Email, Location,
        Experience, Notice period, Skills and more are picked up automatically.
      </p>
      <div className="mt-4 space-y-3">
        <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setSummary(null); setDone(null); }}
          className="block w-full text-[12px] text-dark-text-secondary" />
        <JobSelect jobs={jobs} value={jobId} onChange={setJobId} />
        <div className="flex gap-2">
          <button onClick={() => send(true)} disabled={!file || pending}
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-semibold text-dark-text disabled:opacity-50">Preview</button>
          <button onClick={() => send(false)} disabled={!file || pending || !summary}
            title={!summary ? "Preview first" : undefined}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {pending ? "Working..." : `Import ${summary?.would_create ?? ""}`}
          </button>
        </div>
        {error && <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-dark-text-secondary">{error}</p>}
        {done !== null && (
          <p className="text-[13px] text-emerald-400">
            Imported {done} candidates. <Link href="/dashboard/candidates" className="text-accent hover:underline">View them</Link>
          </p>
        )}
        {summary && done === null && (
          <div className="space-y-2 text-[12px] text-dark-text-secondary">
            <p>
              <span className="font-semibold text-dark-text">{summary.would_create}</span> new ·{" "}
              {summary.duplicates.length} duplicates skipped · {summary.errors.length} rows with problems
            </p>
            <p className="text-dark-text-muted">
              Columns: {Object.entries(summary.columns).map(([h, f]) => `${h} → ${f.replaceAll("_", " ")}`).join(", ")}
            </p>
            {summary.errors.slice(0, 8).map((e) => (
              <p key={e.line} className="text-amber-400">Line {e.line}{e.name ? ` (${e.name})` : ""}: {e.error}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ResumePanel({ jobs }: { jobs: Job[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState(jobs[0]?.id || "");
  const [results, setResults] = useState<ResumeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (jobId) fd.append("job_id", jobId);
    startTransition(async () => {
      const res = await uploadResumes(fd);
      if (res.error) setError(res.error);
      else setResults(res.results || []);
    });
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-dark-text"><FileText className="h-4 w-4" /> Resumes</h2>
      <p className="mt-1 text-[12px] text-dark-text-muted">
        PDF, DOCX or TXT, up to 50 at a time. Neha reads each one, fills in the profile and scores it against the
        job, so the best matches get called first.
      </p>
      <div className="mt-4 space-y-3">
        <input type="file" multiple accept=".pdf,.docx,.txt" onChange={(e) => { setFiles(Array.from(e.target.files || [])); setResults(null); }}
          className="block w-full text-[12px] text-dark-text-secondary" />
        <JobSelect jobs={jobs} value={jobId} onChange={setJobId} />
        <button onClick={send} disabled={!files.length || pending}
          className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
          <Upload className="h-3.5 w-3.5" /> {pending ? `Reading ${files.length} resumes...` : `Upload ${files.length || ""}`}
        </button>
        {error && <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-dark-text-secondary">{error}</p>}
        {results && (
          <table className="w-full text-[12px]">
            <tbody>
              {results.map((r) => (
                <tr key={r.file} className="border-t border-white/[0.05]">
                  <td className="py-1.5 pr-2 text-dark-text-secondary">{r.file}</td>
                  <td className="py-1.5 pr-2">
                    {r.status === "created" && r.candidate_id ? (
                      <Link href={`/dashboard/candidates/${r.candidate_id}`} className="text-accent hover:underline">{r.name}</Link>
                    ) : (
                      <span className="text-dark-text-muted">{r.name || r.error || r.status}</span>
                    )}
                    {r.needs_phone && <span className="ml-1 text-amber-400">(add a phone)</span>}
                  </td>
                  <td className="py-1.5 text-right font-semibold text-dark-text">
                    {r.status === "created" ? (r.match_score != null ? `${r.match_score}% match` : "added") : r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
