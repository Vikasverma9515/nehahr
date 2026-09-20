"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, Phone, X } from "lucide-react";
import {
  cancelInterview,
  markInterviewCompleted,
  submitFeedback,
  triggerReminderCall,
  triggerResultCall,
  type FeedbackData,
} from "@/app/actions/interviews";

export function MarkCompleteButton({ interviewId }: { interviewId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Mark this interview as completed? This will request feedback from the interviewer.")) return;
    startTransition(async () => {
      const res = await markInterviewCompleted(interviewId);
      if (!res.error) router.refresh();
    });
  }

  return (
    <button
      data-ai="mark-interview-complete"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#7dd4a8]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#7dd4a8] hover:bg-[#7dd4a8]/20 disabled:opacity-50"
    >
      <Check className="h-3 w-3" />
      {pending ? "..." : "Mark Complete"}
    </button>
  );
}

export function FeedbackButton({ interviewId }: { interviewId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data: FeedbackData = {
      technical_skills: Number(fd.get("technical_skills") || 3),
      communication: Number(fd.get("communication") || 3),
      culture_fit: Number(fd.get("culture_fit") || 3),
      overall: Number(fd.get("overall") || 3),
      recommendation: (fd.get("recommendation") as string) || "maybe",
      strengths: (fd.get("strengths") as string) || "",
      concerns: (fd.get("concerns") as string) || "",
      notes: (fd.get("notes") as string) || "",
      result: (fd.get("result") as string) || "hold",
    };
    startTransition(async () => {
      const res = await submitFeedback(interviewId, data);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        data-ai="submit-interview-feedback"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#b4a0e8]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#b4a0e8] hover:bg-[#b4a0e8]/20"
      >
        <MessageSquare className="h-3 w-3" />
        Submit Feedback
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-dark-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-5 text-[15px] font-semibold text-dark-text">Interview Feedback</h3>

        {error && (
          <p className="mb-4 rounded-lg bg-white/[0.05] px-3 py-2 text-[11px] text-dark-text-muted">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ratings */}
          <div className="grid grid-cols-2 gap-4">
            {[
              ["technical_skills", "Technical Skills"],
              ["communication", "Communication"],
              ["culture_fit", "Culture Fit"],
              ["overall", "Overall"],
            ].map(([name, label]) => (
              <div key={name}>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">{label}</label>
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name={name} value={v} defaultChecked={v === 3} className="peer sr-only" />
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-[12px] font-bold text-dark-text-muted peer-checked:border-accent/40 peer-checked:bg-white/[0.06] peer-checked:text-dark-text">
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
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">Recommendation</label>
            <select name="recommendation" defaultValue="maybe" className="mt-1.5 w-full rounded-lg px-3 py-2 text-[13px]">
              <option value="strong_yes">Strong Yes</option>
              <option value="yes">Yes</option>
              <option value="maybe">Maybe</option>
              <option value="no">No</option>
              <option value="strong_no">Strong No</option>
            </select>
          </div>

          {/* Result */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">Result</label>
            <div className="mt-1.5 flex gap-2">
              {[
                ["pass", "Pass"],
                ["hold", "Hold"],
                ["fail", "Fail"],
              ].map(([val, label]) => (
                <label key={val} className="cursor-pointer flex-1">
                  <input type="radio" name="result" value={val} defaultChecked={val === "hold"} className="peer sr-only" />
                  <span className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-[12px] font-semibold text-dark-text-muted peer-checked:border-accent/40 peer-checked:bg-white/[0.06] peer-checked:text-dark-text">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Text fields */}
          <div className="space-y-3">
            {[
              ["strengths", "Strengths"],
              ["concerns", "Concerns / Areas of Improvement"],
              ["notes", "Additional Notes"],
            ].map(([name, label]) => (
              <div key={name}>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">{label}</label>
                <textarea
                  name={name}
                  rows={2}
                  placeholder={`${label}...`}
                  className="mt-1.5 w-full rounded-lg px-3 py-2 text-[13px]"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-dark-text-muted hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary rounded-lg px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReminderCallButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await triggerReminderCall(candidateId);
      router.refresh();
    });
  }

  return (
    <button
      data-ai="send-reminder-call"
      title="Have Neha call the candidate to remind them of the interview"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#d4c27d]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#d4c27d] hover:bg-[#d4c27d]/20 disabled:opacity-50"
    >
      <Phone className="h-3 w-3" />
      {pending ? "Calling..." : "Remind"}
    </button>
  );
}

// One-click reasons HR will pick 95% of the time. "Other" reveals a textarea
// for the rare case that needs a custom note. Picking a preset = zero typing.
const CANCEL_REASONS = [
  "Interviewer no longer available",
  "Candidate no longer available",
  "Candidate withdrew",
  "Scheduling conflict",
] as const;

export function CancelMeetingButton({ interviewId }: { interviewId: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null); // null = nothing picked yet
  const [otherNote, setOtherNote] = useState("");
  const [reschedule, setReschedule] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isOther = picked === "Other";
  // Final reason: a preset string, or the custom note when "Other" is picked,
  // or undefined for "no reason given" (sends a generic email).
  const finalReason = isOther
    ? otherNote.trim() || undefined
    : picked || undefined;

  function reset() {
    setPicked(null);
    setOtherNote("");
    setError(null);
  }

  function handleConfirm() {
    if (isOther && !otherNote.trim()) {
      setError("Please add a note or pick another reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelInterview(interviewId, {
        reason: finalReason,
        reschedule,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        data-ai="cancel-interview-meeting"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#e89090]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#e89090] hover:bg-[#e89090]/20"
      >
        <X className="h-3 w-3" />
        Cancel Meeting
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => !pending && setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-dark-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-dark-text">Cancel this meeting?</h3>
        <p className="mt-1 text-[12px] text-dark-text-muted">
          The calendar event will be deleted and both parties will get a cancellation email.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-[#e89090]/10 px-3 py-2 text-[11px] text-[#e89090]">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          {/* One-click reasons */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-text-muted">
              Why?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_REASONS.map((r) => {
                const active = picked === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPicked(active ? null : r)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                      active
                        ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                        : "bg-white/[0.04] text-dark-text-secondary hover:bg-white/[0.08] hover:text-dark-text"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPicked(isOther ? null : "Other")}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  isOther
                    ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                    : "bg-white/[0.04] text-dark-text-secondary hover:bg-white/[0.08] hover:text-dark-text"
                }`}
              >
                Other...
              </button>
            </div>

            {isOther && (
              <textarea
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Briefly explain..."
                className="mt-2.5 w-full rounded-lg px-3 py-2 text-[13px]"
              />
            )}

            {!picked && (
              <p className="mt-2 text-[10px] text-dark-text-muted">
                Optional — skip to send a generic note.
              </p>
            )}
          </div>

          {/* Reschedule toggle */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
            <input
              type="checkbox"
              checked={reschedule}
              onChange={(e) => setReschedule(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <div>
              <p className="text-[12px] font-semibold text-dark-text">Reschedule later</p>
              <p className="mt-0.5 text-[11px] text-dark-text-muted">
                Moves the candidate back to Shortlisted so you can schedule again.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-lg bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-dark-text-muted hover:bg-white/[0.08] disabled:opacity-50"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#e89090] px-5 py-2 text-[12px] font-semibold text-[#1a0f0f] hover:bg-[#f0a0a0] disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              {pending ? "Cancelling..." : "Cancel Meeting"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultCallButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Trigger a call to communicate the interview result to this candidate?")) return;
    startTransition(async () => {
      await triggerResultCall(candidateId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#8ab4d9]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#8ab4d9] hover:bg-[#8ab4d9]/20 disabled:opacity-50"
    >
      <Phone className="h-3 w-3" />
      {pending ? "Calling..." : "Call Result"}
    </button>
  );
}
