"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { sendCandidateMessage } from "@/app/actions/candidates";

export type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  author: string;
  channel: string;
  status: string;
  created_at: string;
};

export function MessagesCard({ candidateId, messages, optedOut }: { candidateId: string; messages: MessageRow[]; optedOut: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await sendCandidateMessage(candidateId, body);
      if (res.error) setError(res.error);
      else {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">
        <MessageCircle className="h-3.5 w-3.5" /> Messages
      </h2>
      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-[12px] text-dark-text-muted">No messages yet. Neha texts automatically after a missed call and when an interview is booked.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.direction === "inbound" ? "pr-8" : "pl-8 text-right"}>
            <span className={"inline-block rounded-xl px-3 py-2 text-left text-[12px] " +
              (m.direction === "inbound" ? "bg-white/[0.05] text-dark-text" : "bg-accent/20 text-dark-text")}>
              {m.body}
            </span>
            <p className="mt-0.5 text-[10px] text-dark-text-muted">
              {m.direction === "inbound" ? "Candidate" : m.author === "recruiter" ? "You" : "Neha"} · {m.channel} ·{" "}
              {new Date(m.created_at).toLocaleString()}{m.status === "failed" ? " · failed" : ""}
            </p>
          </div>
        ))}
      </div>
      {optedOut ? (
        <p className="mt-3 text-[12px] text-dark-text-muted">The candidate replied STOP, so messages are off.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Write on WhatsApp..." className="block w-full rounded-lg px-3 py-2 text-[12px]" />
          <button onClick={send} disabled={pending || !text.trim()} aria-label="Send"
            className="btn-primary rounded-lg px-3 text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
