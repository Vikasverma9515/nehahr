"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCandidate } from "@/app/actions/candidates";

export function DeleteCandidateButton({ candidateId }: { candidateId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteCandidate(candidateId);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-danger">Delete candidate and all data?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-danger hover:bg-white/[0.08] disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] font-medium text-dark-text-muted hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-white/[0.06] p-2 text-dark-text-muted transition-all hover:bg-white/[0.06] hover:text-dark-text-secondary"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
