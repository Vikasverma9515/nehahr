"use client";

import { useState, useTransition } from "react";
import { applyToJob } from "@/app/actions/careers";

const input = "mt-1.5 block w-full rounded-xl px-3 py-2.5 text-[14px]";

export function ApplyForm({ slug, jobId, company }: { slug: string; jobId: string; company: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="card-glass h-fit rounded-2xl p-6">
        <h2 className="text-[18px] font-semibold">Thanks, you&apos;re in!</h2>
        <p className="mt-2 text-[14px] text-dark-text-secondary">
          Neha, {company}&apos;s AI recruiter, will call you for a short chat. Keep your phone handy.
        </p>
      </div>
    );
  }

  return (
    <form
      className="card-glass h-fit space-y-4 rounded-2xl p-6"
      action={(fd) => startTransition(async () => {
        setError(null);
        const res = await applyToJob(slug, jobId, fd);
        if (res.error) setError(res.error);
        else setDone(true);
      })}
    >
      <h2 className="text-[18px] font-semibold">Apply</h2>
      <label className="block text-[12px] text-dark-text-muted">Full name
        <input name="name" required className={input} autoComplete="name" /></label>
      <label className="block text-[12px] text-dark-text-muted">Phone
        <input name="phone" required type="tel" className={input} placeholder="+91 98765 43210" autoComplete="tel" /></label>
      <label className="block text-[12px] text-dark-text-muted">Email
        <input name="email" type="email" className={input} autoComplete="email" /></label>
      <label className="block text-[12px] text-dark-text-muted">Resume (PDF or DOCX)
        <input name="resume" type="file" accept=".pdf,.docx,.txt" className="mt-1.5 block w-full text-[12px]" /></label>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-[12px] text-dark-text-secondary">
        <input type="checkbox" name="consent" value="true" required className="mt-0.5" />
        I agree that {company} may call, message and email me about this application, including an AI recruiter call that is recorded.
      </label>
      {error && <p className="text-[13px] text-amber-400">{error}</p>}
      <button disabled={pending} className="btn-primary w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50">
        {pending ? "Sending..." : "Submit application"}
      </button>
    </form>
  );
}
