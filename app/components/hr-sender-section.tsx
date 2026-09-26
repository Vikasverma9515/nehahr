"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, Trash2 } from "lucide-react";
import { disconnectHrSender, getConnectHrSenderUrl, type HrSenderStatus } from "@/app/actions/hr-sender";

export function HrSenderSection({ status }: { status: HrSenderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleConnect() {
    // Browser navigates to a signed backend OAuth start link, which redirects
    // to Google's consent screen, then back to our callback.
    window.location.assign(await getConnectHrSenderUrl());
  }

  function handleDisconnect() {
    if (
      !confirm(
        "Disconnect the HR sender account? Booking emails will fall back to sending from the interviewer's own Gmail until a new HR account is connected."
      )
    )
      return;
    startTransition(async () => {
      await disconnectHrSender();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">
            HR Sender Account
          </h2>
          <p className="mt-1 text-[11px] text-dark-text-muted">
            The Google account that sends all interview confirmation emails. Candidates see this as the sender instead of the individual interviewer.
          </p>
        </div>
      </div>

      {status.connected ? (
        <div className="row-item flex items-center justify-between rounded-xl px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-dark-text">
                {status.name || "HR Recruiting"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-dark-text-secondary">
                <Check className="h-2.5 w-2.5" />
                Connected
              </span>
            </div>
            <p className="truncate text-[11px] text-dark-text-muted">
              {status.email}
              {status.connected_at &&
                ` · since ${new Date(status.connected_at).toLocaleDateString()}`}
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={pending}
            className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted hover:bg-white/[0.06] hover:text-dark-text-secondary disabled:opacity-50"
            aria-label="Disconnect HR sender"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[12px] leading-relaxed text-dark-text-muted">
            No HR sender account connected yet. Until you connect one, booking emails will fall back to being sent from the interviewer&apos;s own Gmail account (with <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px]">Recruiting Team</code> as the display name).
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-dark-text-muted">
            For a truly professional flow, connect a dedicated recruiting account (e.g. <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px]">recruiting@example.com</code>). Candidates will then see that address as the real sender.
          </p>
          <button
            onClick={handleConnect}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-[12px] font-semibold text-accent hover:bg-white/[0.08]"
          >
            <Mail className="h-3.5 w-3.5" />
            Connect HR Email
          </button>
        </div>
      )}
    </div>
  );
}
