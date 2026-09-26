"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { inviteTeammate, revokeInvite, type TeamRole } from "@/app/actions/team";
import { PersonAvatar } from "@/app/components/person-avatar";

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  interviewer: "Interviewer",
  viewer: "Viewer",
};

type Props = {
  org: { id: string; name: string } | null;
  members: { user_id: string; email: string; full_name: string | null; role: TeamRole }[];
  invites: { id: string; email: string; role: TeamRole }[];
};

export function TeamSection({ org, members, invites }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleInvite(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await inviteTeammate(formData);
      if (res.error) setError(res.error);
      else {
        setShowForm(false);
        router.refresh();
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeInvite(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-dark-text">Team</h2>
          <p className="mt-0.5 text-[11px] text-dark-text-muted">
            {org ? `${org.name}. ` : ""}Teammates see the same jobs, candidates and calls.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-dark-text-secondary hover:bg-white/[0.08] hover:text-dark-text"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Invite teammate"}
        </button>
      </div>

      {showForm && (
        <form action={handleInvite} className="mb-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {error && (
            <div className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-dark-text-secondary">{error}</div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Email</label>
              <input name="email" type="email" required placeholder="priya@company.com"
                className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Role</label>
              <select name="role" defaultValue="recruiter" className="mt-1.5 block w-full rounded-lg px-3 py-2 text-[13px]">
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-dark-text-muted">
            They join this team automatically when they sign up with this email.
          </p>
          <button type="submit" disabled={pending}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {pending ? "Inviting..." : "Send invite"}
          </button>
        </form>
      )}

      <div className="space-y-2.5">
        {members.map((m) => (
          <div key={m.user_id} className="row-item flex items-center gap-3 rounded-xl px-4 py-3">
            <PersonAvatar name={m.full_name || m.email} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-dark-text">{m.full_name || m.email}</p>
              <p className="truncate text-[11px] text-dark-text-muted">{m.email}</p>
            </div>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-dark-text-secondary">
              {ROLE_LABELS[m.role] || m.role}
            </span>
          </div>
        ))}
        {invites.map((i) => (
          <div key={i.id} className="row-item flex items-center gap-3 rounded-xl px-4 py-3 opacity-70">
            <PersonAvatar name={i.email} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-dark-text">{i.email}</p>
              <p className="text-[11px] text-dark-text-muted">Invited as {ROLE_LABELS[i.role] || i.role}</p>
            </div>
            <button onClick={() => handleRevoke(i.id)} aria-label="Revoke invite"
              className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted hover:bg-white/[0.06]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
