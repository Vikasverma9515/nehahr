"use client";

import { useState, useTransition } from "react";
import { Calendar, Check, Plus, Trash2, X } from "lucide-react";
import { createInterviewer, deleteInterviewer, getConnectGoogleUrl, getConnectOutlookUrl } from "@/app/actions/interviewers";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/app/components/person-avatar";

type Interviewer = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  working_hours_start: number;
  working_hours_end: number;
  is_active: boolean;
  google_connected_at: string | null;
  ms_connected_at?: string | null;
  calendar_provider?: string | null;
};

export function InterviewersSection({ interviewers }: { interviewers: Interviewer[] }) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createInterviewer(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setShowForm(false);
        router.refresh();
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this interviewer? They will be removed from any jobs using them as default.")) return;
    startTransition(async () => {
      await deleteInterviewer(id);
      router.refresh();
    });
  }

  async function handleConnectOutlook(interviewerId: string) {
    window.location.assign(await getConnectOutlookUrl(interviewerId));
  }

  async function handleConnectCalendar(interviewerId: string) {
    // The backend only accepts OAuth start links signed by the dashboard.
    window.location.assign(await getConnectGoogleUrl(interviewerId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-normal uppercase tracking-[0.1em] text-dark-text-secondary">
          Interviewers
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.08] hover:text-dark-text"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add interviewer"}
        </button>
      </div>

      {showForm && (
        <form action={handleCreate} className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          {error && (
            <div className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-dark-text-secondary">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                Name
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="Anil Kapoor"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="anil@example.com"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                Timezone
              </label>
              <input
                name="timezone"
                type="text"
                defaultValue="Asia/Kolkata"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                Start (24h)
              </label>
              <input
                name="working_hours_start"
                type="number"
                defaultValue={9}
                min={0}
                max={23}
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                End (24h)
              </label>
              <input
                name="working_hours_end"
                type="number"
                defaultValue={18}
                min={1}
                max={24}
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Interviewer"}
          </button>
        </form>
      )}

      {interviewers.length === 0 ? (
        <p className="text-[13px] text-dark-text-muted">
          No interviewers yet. Add one above to enable scheduling calls.
        </p>
      ) : (
        <div className="space-y-2.5">
          {interviewers.map((i) => {
            const isConnected = i.calendar_provider === "microsoft" ? !!i.ms_connected_at : !!i.google_connected_at;
            return (
              <div key={i.id} className="row-item flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <PersonAvatar name={i.name} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-dark-text">{i.name}</p>
                    {isConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-dark-text-secondary">
                        <Check className="h-2.5 w-2.5" />
                        {i.calendar_provider === "microsoft" ? "Outlook connected" : "Google Calendar connected"}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-dark-text-muted">
                    {i.email} - {i.timezone} - {i.working_hours_start}:00–{i.working_hours_end}:00
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isConnected && (
                    <button
                      onClick={() => handleConnectCalendar(i.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-white/[0.08]"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Google Calendar
                    </button>
                  )}
                  {!isConnected && (
                    <button
                      onClick={() => handleConnectOutlook(i.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-white/[0.08]"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Outlook
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(i.id)}
                    className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted hover:bg-white/[0.06] hover:text-dark-text-secondary"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
