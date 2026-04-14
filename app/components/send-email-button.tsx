"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import {
  getEmailTemplate,
  sendResultEmail,
  type EmailTemplate,
} from "@/app/actions/interviews";

export function SendEmailButton({
  interviewId,
  result,
  overrideAs,
  label: labelOverride,
  tone,
}: {
  interviewId: string;
  result: string;
  // HR override — force a specific template regardless of the interviewer's
  // recommendation (e.g. show a rejection template even when result=pass).
  overrideAs?: "pass" | "hold" | "fail";
  // Optional custom button label — defaults to "Send Offer/Rejection/Update Email"
  label?: string;
  // Optional explicit color tone — otherwise derived from `result`
  tone?: "positive" | "warning" | "negative";
}) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  // Editable fields
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const tpl = await getEmailTemplate(interviewId, overrideAs);
    if (tpl) {
      setTemplate(tpl);
      setToEmail(tpl.to_email);
      setSubject(tpl.subject);
      setBody(tpl.body);
    } else {
      setError("Could not load email template");
    }
    setLoading(false);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const res = await sendResultEmail(interviewId, {
        to_email: toEmail,
        subject,
        body,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setSent(true);
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 2000);
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Derive button tone from the effective result (override wins)
  const effective = overrideAs || result;
  const toneKey: "positive" | "warning" | "negative" =
    tone ||
    (effective === "pass"
      ? "positive"
      : effective === "fail"
        ? "negative"
        : "warning");
  const resultLabel = effective === "pass" ? "Offer" : effective === "fail" ? "Rejection" : "Update";
  const buttonColor =
    toneKey === "positive"
      ? "bg-[#7dd4a8]/10 text-[#7dd4a8] hover:bg-[#7dd4a8]/20"
      : toneKey === "negative"
        ? "bg-[#e8908a]/10 text-[#e8908a] hover:bg-[#e8908a]/20"
        : "bg-[#d4c27d]/10 text-[#d4c27d] hover:bg-[#d4c27d]/20";

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${buttonColor}`}
      >
        <Mail className="h-3 w-3" />
        {labelOverride || `Send ${resultLabel} Email`}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#111116] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#7dd4a8]/10">
              <Mail className="h-6 w-6 text-[#7dd4a8]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#f0f0f5]">Email sent!</h3>
            <p className="mt-1 text-[13px] text-[#b0b1c4]">
              {resultLabel} email sent to {toEmail}
            </p>
          </div>
        ) : (
          <>
            <h3 className="mb-5 text-[15px] font-semibold text-[#f0f0f5]">
              Send {resultLabel} Email to Candidate
            </h3>

            {error && (
              <p className="mb-4 rounded-lg bg-white/[0.05] px-3 py-2 text-[11px] text-[#e8908a]">
                {error}
              </p>
            )}

            {loading ? (
              <p className="py-8 text-center text-[13px] text-[#787994]">Loading template...</p>
            ) : (
              <div className="space-y-4">
                {/* To */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-1.5">
                    To
                  </label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2.5 text-[13px] text-[#f0f0f5]"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2.5 text-[13px] text-[#f0f0f5]"
                  />
                </div>

                {/* Body — editable */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b0b1c4] mb-1.5">
                    Email Body
                    <span className="ml-2 font-normal normal-case tracking-normal text-[#787994]">
                      — edit as needed
                    </span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2.5 text-[13px] leading-relaxed text-[#f0f0f5]"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-[#787994]">
                    Sent from your HR sender account
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setOpen(false)}
                      className="rounded-lg bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-[#b0b1c4] hover:bg-white/[0.08]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending || !toEmail || !subject || !body}
                      className="rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-5 py-2 text-[12px] font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "Send Email"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
