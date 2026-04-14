"use client";

import { useState } from "react";

const BACKEND_URL = "http://localhost:8000";

export function FeedbackForm({
  token,
  candidateName,
}: {
  token: string;
  candidateName: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      technical_skills: Number(fd.get("technical_skills") || 3),
      communication: Number(fd.get("communication") || 3),
      culture_fit: Number(fd.get("culture_fit") || 3),
      overall: Number(fd.get("overall") || 3),
      recommendation: fd.get("recommendation") as string || "maybe",
      strengths: fd.get("strengths") as string || "",
      concerns: fd.get("concerns") as string || "",
      notes: fd.get("notes") as string || "",
      result: fd.get("result") as string || "hold",
    };

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/interviews/feedback-form/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        setError(err.detail || "Failed to submit");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setResult(data.result);
      setSubmitted(true);
    } catch {
      setError("Could not reach server. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#7dd4a8]/10">
          <svg className="h-8 w-8 text-[#7dd4a8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-[#f0f0f5]">Thank you!</h2>
        <p className="mt-2 text-[14px] text-[#b0b1c4]">
          Your feedback for {candidateName} has been recorded.
          {result && <span className="block mt-1">Result: <span className="font-semibold text-[#f0f0f5] capitalize">{result}</span></span>}
        </p>
        <p className="mt-4 text-[12px] text-[#787994]">You can close this tab.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-[#e8908a]">{error}</p>
      )}

      {/* Ratings */}
      <div className="grid grid-cols-2 gap-5">
        {[
          ["technical_skills", "Technical Skills"],
          ["communication", "Communication"],
          ["culture_fit", "Culture Fit"],
          ["overall", "Overall Impression"],
        ].map(([name, label]) => (
          <div key={name}>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-2">
              {label}
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <label key={v} className="cursor-pointer flex-1">
                  <input
                    type="radio"
                    name={name}
                    value={v}
                    defaultChecked={v === 3}
                    className="peer sr-only"
                  />
                  <span className="flex h-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] font-bold text-[#787994] transition-all peer-checked:border-[#8b5cf6]/40 peer-checked:bg-[#8b5cf6]/10 peer-checked:text-[#f0f0f5]">
                    {v}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-2">
          Recommendation
        </label>
        <select
          name="recommendation"
          defaultValue="maybe"
          className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2.5 text-[13px] text-[#f0f0f5]"
        >
          <option value="strong_yes">Strong Yes — definitely hire</option>
          <option value="yes">Yes — would hire</option>
          <option value="maybe">Maybe — needs discussion</option>
          <option value="no">No — would not hire</option>
          <option value="strong_no">Strong No — clear reject</option>
        </select>
      </div>

      {/* Result */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-2">
          Result
        </label>
        <div className="flex gap-2">
          {[
            ["pass", "Pass — move forward"],
            ["hold", "Hold — decide later"],
            ["fail", "Fail — reject"],
          ].map(([val, label]) => (
            <label key={val} className="cursor-pointer flex-1">
              <input type="radio" name="result" value={val} defaultChecked={val === "hold"} className="peer sr-only" />
              <span className="flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-semibold text-[#787994] transition-all peer-checked:border-[#8b5cf6]/40 peer-checked:bg-[#8b5cf6]/10 peer-checked:text-[#f0f0f5]">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="space-y-4">
        {[
          ["strengths", "Strengths", "What did the candidate do well?"],
          ["concerns", "Concerns", "Any areas of improvement or red flags?"],
          ["notes", "Additional Notes", "Anything else the hiring team should know?"],
        ].map(([name, label, placeholder]) => (
          <div key={name}>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-2">
              {label}
            </label>
            <textarea
              name={name}
              rows={2}
              placeholder={placeholder}
              className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder-[#525367]"
            />
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] py-3 text-[14px] font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 transition-all hover:shadow-[#8b5cf6]/30 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </button>

      <p className="text-center text-[11px] text-[#787994]">
        Your feedback is confidential and visible only to the hiring team.
      </p>
    </form>
  );
}
