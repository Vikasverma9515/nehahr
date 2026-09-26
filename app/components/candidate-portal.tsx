"use client";

import { useState, useTransition } from "react";
import { Calendar, Check, Phone, Video } from "lucide-react";
import { bookSlot, getSlots, requestCall, sendPortalRequest, type PortalInfo, type Slot } from "@/app/actions/portal";

const card = "card-glass rounded-2xl p-6";

export function CandidatePortal({ token, info }: { token: string; info: PortalInfo }) {
  return (
    <div className="space-y-5">
      <div className={card}>
        <h1 className="font-display text-[24px]">Hi {info.first_name || "there"}</h1>
        <p className="mt-1 text-[13px] text-dark-text-muted">{info.job_title || "Your application"} at {info.company}</p>
        <p className="mt-4 text-[14px] text-dark-text-secondary">{info.message}</p>
        <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
          {info.steps.map((s, i) => (
            <li key={s} className={"flex items-center gap-1.5 text-[12px] " + (i <= info.step ? "text-dark-text" : "text-dark-text-muted")}>
              <span className={"flex h-5 w-5 items-center justify-center rounded-full text-[10px] " +
                (i < info.step ? "bg-emerald-500/80 text-white" : i === info.step ? "bg-accent text-white" : "bg-white/[0.06]")}>
                {i < info.step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {info.next_interview && (
        <div className={card}>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Calendar className="h-4 w-4" /> Your interview</h2>
          <p className="mt-2 text-[14px] text-dark-text-secondary">
            {new Date(info.next_interview.scheduled_at).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
            {" · "}{info.next_interview.duration_minutes} min {info.next_interview.interview_type.replace("_", " ")}
          </p>
          {info.next_interview.meeting_link && (
            <a href={info.next_interview.meeting_link} target="_blank" rel="noopener noreferrer"
              className="btn-primary mt-4 inline-flex rounded-xl px-4 py-2 text-[13px] font-semibold text-white">Join meeting</a>
          )}
          <RequestBox token={token} kind="reschedule" label="Need a different time?" placeholder="Times that work for you" />
        </div>
      )}

      {info.ai_interview_link && (
        <div className={card}>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Video className="h-4 w-4" /> Video interview</h2>
          <p className="mt-2 text-[13px] text-dark-text-secondary">A 15-minute first round with Neha, whenever suits you.</p>
          <a href={info.ai_interview_link} className="btn-primary mt-4 inline-flex rounded-xl px-4 py-2 text-[13px] font-semibold text-white">Start</a>
        </div>
      )}

      {info.can_self_schedule && <SlotPicker token={token} />}

      {!info.closed && <CallMe token={token} />}

      {!info.closed && (
        <div className={card}>
          <RequestBox token={token} kind="question" label="Ask the recruiting team" placeholder="Your question" />
          <RequestBox token={token} kind="withdraw" label="No longer interested?" placeholder="Tell us why (optional)" danger />
        </div>
      )}
    </div>
  );
}

function SlotPicker({ token }: { token: string }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => startTransition(async () => {
    const res = await getSlots(token);
    if (res.error) setError(res.error);
    else setSlots(res.data?.slots || []);
  });

  const book = (s: Slot) => startTransition(async () => {
    setError(null);
    const res = await bookSlot(token, s.start);
    if (res.error) setError(res.error);
    else setDone(s.label);
  });

  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Calendar className="h-4 w-4" /> Pick your interview time</h2>
      {done ? (
        <p className="mt-3 text-[14px] text-emerald-400">Booked for {done}. The invite with the meeting link is on its way to your email.</p>
      ) : slots === null ? (
        <button onClick={load} disabled={pending} className="btn-primary mt-4 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? "Checking the calendar..." : "Show open times"}
        </button>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-[13px] text-dark-text-secondary">No open times this week. Ask for a call below and we&apos;ll find one together.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((s) => (
            <button key={s.start} onClick={() => book(s)} disabled={pending}
              className="rounded-xl border border-white/[0.08] px-4 py-3 text-left text-[13px] text-dark-text hover:border-accent/60 hover:bg-accent/10 disabled:opacity-50">
              {s.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-amber-400">{error}</p>}
    </div>
  );
}

function CallMe({ token }: { token: string }) {
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const go = (later: boolean) => startTransition(async () => {
    const res = await requestCall(token, later && when ? new Date(when).toISOString() : undefined);
    setMsg(res.error || (later ? `Neha will call you at ${new Date(res.data!.at).toLocaleString()}.` : "Neha will call you in a few seconds."));
  });
  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Phone className="h-4 w-4" /> Talk to Neha</h2>
      <p className="mt-2 text-[13px] text-dark-text-secondary">Get a call now, or pick a time that suits you.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => go(false)} disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">Call me now</button>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-xl px-3 py-2 text-[13px]" />
        <button onClick={() => go(true)} disabled={pending || !when} className="rounded-xl bg-white/[0.06] px-4 py-2 text-[13px] font-semibold disabled:opacity-50">Call me then</button>
      </div>
      {msg && <p className="mt-3 text-[13px] text-dark-text-secondary">{msg}</p>}
    </div>
  );
}

function RequestBox({ token, kind, label, placeholder, danger }: { token: string; kind: string; label: string; placeholder: string; danger?: boolean }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  if (sent) return <p className="mt-4 text-[13px] text-emerald-400">Sent. A recruiter will get back to you within a working day.</p>;
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-dark-text">{label}</p>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="block w-full rounded-xl px-3 py-2 text-[13px]" />
        <button disabled={pending || (!text.trim() && kind !== "withdraw")}
          onClick={() => startTransition(async () => { const r = await sendPortalRequest(token, kind, text); if (!r.error) setSent(true); })}
          className={"rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-50 " + (danger ? "bg-red-500/70 text-white" : "bg-white/[0.08]")}>
          {danger ? "Withdraw" : "Send"}
        </button>
      </div>
    </div>
  );
}
