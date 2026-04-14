import { clsx } from "clsx";

type Message = {
  speaker: "neha" | "candidate" | "other";
  text: string;
};

function parseTranscript(raw: string): Message[] {
  if (!raw) return [];

  const lines = raw.split("\n");
  const messages: Message[] = [];
  let current: Message | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nehaMatch = /^(Neha|NEHA|neha)\s*[:\-]\s*(.*)$/.exec(trimmed);
    const candidateMatch = /^(Candidate|CANDIDATE|candidate)\s*[:\-]\s*(.*)$/.exec(trimmed);

    if (nehaMatch) {
      if (current) messages.push(current);
      current = { speaker: "neha", text: nehaMatch[2] };
    } else if (candidateMatch) {
      if (current) messages.push(current);
      current = { speaker: "candidate", text: candidateMatch[2] };
    } else {
      // Continuation of previous message, or a line without a speaker prefix
      if (current) {
        current.text += " " + trimmed;
      } else {
        current = { speaker: "other", text: trimmed };
      }
    }
  }

  if (current) messages.push(current);
  return messages;
}

export function CallTranscript({ transcript }: { transcript: string | null }) {
  if (!transcript) {
    return (
      <p className="text-[13px] text-dark-text-muted">
        No transcript available yet
      </p>
    );
  }

  const messages = parseTranscript(transcript);

  if (messages.length === 0) {
    return (
      <p className="text-[13px] text-dark-text-muted">
        No transcript available yet
      </p>
    );
  }

  return (
    <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
      {messages.map((msg, i) => {
        const isNeha = msg.speaker === "neha";
        const isCandidate = msg.speaker === "candidate";

        return (
          <div
            key={i}
            className={clsx(
              "flex gap-3",
              isCandidate ? "justify-end" : "justify-start"
            )}
          >
            {isNeha && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-700 text-[11px] font-bold text-white">
                N
              </div>
            )}

            <div
              className={clsx(
                "max-w-[78%] rounded-2xl px-4 py-2.5",
                isNeha && "rounded-tl-sm bg-accent-muted border border-accent/15",
                isCandidate && "rounded-tr-sm bg-white/[0.04] border border-white/[0.08]",
                msg.speaker === "other" && "bg-white/[0.02] border border-white/[0.05]"
              )}
            >
              <div
                className={clsx(
                  "mb-0.5 text-[10px] font-normal uppercase tracking-[0.1em]",
                  isNeha ? "text-accent" : "text-dark-text-muted"
                )}
              >
                {isNeha ? "Neha" : isCandidate ? "Candidate" : "System"}
              </div>
              <p className="text-[13px] leading-relaxed text-dark-text">
                {msg.text}
              </p>
            </div>

            {isCandidate && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[11px] font-semibold text-dark-text-secondary">
                C
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
