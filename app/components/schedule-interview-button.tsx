"use client";

import { useState, useTransition, useEffect } from "react";
import { Calendar, Loader2, Phone, X, Plus, Check, RefreshCw } from "lucide-react";
import { previewSlots, triggerSchedulingCall, listInterviewers } from "@/app/actions/schedule";

type Slot = {
  start: string;
  end: string;
  label: string;
};

type Preview = {
  candidate: { id: string; name: string; phone: string };
  job_title: string;
  interviewer: { id: string; name: string; email: string };
  interview_type: string;
  duration_minutes: number;
  slots: Slot[];
};

export function ScheduleInterviewButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);

  // Editable state
  const [selectedSlots, setSelectedSlots] = useState<boolean[]>([]);
  const [interviewType, setInterviewType] = useState("video");
  const [duration, setDuration] = useState(60);
  const [allInterviewers, setAllInterviewers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string>("");
  const [panelIds, setPanelIds] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function handleClick() {
    setError(null);
    startTransition(async () => {
      const [res, interviewers] = await Promise.all([
        previewSlots(candidateId),
        listInterviewers(),
      ]);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const data = res.data as Preview;
        setPreview(data);
        setSelectedSlots(data.slots.map(() => true));
        setInterviewType(data.interview_type);
        setDuration(data.duration_minutes);
        setAllInterviewers(interviewers);
        setSelectedInterviewerId(data.interviewer.id);
      }
    });
  }

  async function handleChangeInterviewer(newId: string, panel: string[] = panelIds) {
    setSelectedInterviewerId(newId);
    const nextPanel = panel.filter((p) => p !== newId);
    setPanelIds(nextPanel);
    setLoadingSlots(true);
    setError(null);
    const res = await previewSlots(candidateId, newId, nextPanel);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const data = res.data as Preview;
      setPreview(data);
      setSelectedSlots(data.slots.map(() => true));
    }
    setLoadingSlots(false);
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);

    // Filter to only selected slots
    const filtered = preview.slots.filter((_, i) => selectedSlots[i]);

    startTransition(async () => {
      const res = await triggerSchedulingCall(
        candidateId,
        selectedInterviewerId || undefined,
        filtered,
        interviewType,
        duration,
        panelIds,
      );
      if (res.error) {
        setError(res.error);
      } else {
        setTriggered(true);
      }
    });
  }

  function toggleSlot(index: number) {
    setSelectedSlots((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  const selectedCount = selectedSlots.filter(Boolean).length;

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  if (triggered) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-dark-text-secondary">
        <Phone className="h-4 w-4" />
        Neha is calling...
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={handleClick}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {pending && !preview ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calendar className="h-3.5 w-3.5" />
          )}
          {pending && !preview ? "Finding slots..." : "Schedule Interview"}
        </button>
        {error && !preview && (
          <p className="max-w-sm text-right text-[11px] text-[#e8908a]">{error}</p>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111116] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#f0f0f5]">Schedule Interview</h3>
                <p className="mt-0.5 text-[12px] text-[#b0b1c4]">
                  {preview.candidate.name} · {preview.job_title}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg p-1.5 text-[#787994] hover:bg-white/[0.06] hover:text-[#b0b1c4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Editable settings */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787994] mb-1.5">
                  Interviewer
                </label>
                {allInterviewers.length > 1 ? (
                  <select
                    value={selectedInterviewerId}
                    onChange={(e) => handleChangeInterviewer(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2 text-[12px] text-[#f0f0f5]"
                  >
                    {allInterviewers.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2 text-[12px] text-[#f0f0f5]">
                    {preview.interviewer.name}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787994] mb-1.5">
                  Format
                </label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2 text-[12px] text-[#f0f0f5]"
                >
                  <option value="video">Video (Meet)</option>
                  <option value="in_person">In Person</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787994] mb-1.5">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a22] px-3 py-2 text-[12px] text-[#f0f0f5]"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
            </div>

            {/* Panel: others who must be free too */}
            {allInterviewers.length > 1 && (
              <div className="mb-5">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787994]">
                  Panel (only times everyone is free)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allInterviewers.filter((i) => i.id !== selectedInterviewerId).map((i) => {
                    const on = panelIds.includes(i.id);
                    return (
                      <button key={i.id} type="button"
                        onClick={() => handleChangeInterviewer(selectedInterviewerId, on ? panelIds.filter((x) => x !== i.id) : [...panelIds, i.id])}
                        className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-accent/50 bg-accent/15 text-[#f0f0f5]" : "border-white/[0.08] text-[#787994]"}`}>
                        {on ? "✓ " : "+ "}{i.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Slots with checkboxes */}
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787994]">
                Available Slots
              </p>
              <p className="text-[10px] text-[#787994]">
                {selectedCount} of {preview.slots.length} selected
              </p>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[12px] text-[#787994]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading slots for {allInterviewers.find(i => i.id === selectedInterviewerId)?.name || "interviewer"}...
              </div>
            ) : preview.slots.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#e8908a]">
                No free slots in the next 7 business days. Try a different interviewer.
              </p>
            ) : (
              <div className="mb-4 max-h-56 space-y-1 overflow-y-auto">
                {preview.slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSlot(i)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[12px] transition-all ${
                      selectedSlots[i]
                        ? "border-accent/30 bg-accent/[0.06] text-[#f0f0f5]"
                        : "border-white/[0.06] bg-transparent text-[#787994] line-through"
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selectedSlots[i]
                          ? "border-accent bg-accent/20"
                          : "border-white/[0.15] bg-transparent"
                      }`}
                    >
                      {selectedSlots[i] && <Check className="h-2.5 w-2.5 text-accent" />}
                    </div>
                    <span className="font-medium">{slot.label}</span>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2 text-[11px] text-[#e8908a]">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <p className="text-[10px] text-[#787994]">
                Neha will call {preview.candidate.name} and offer {selectedCount} slot{selectedCount !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-xl bg-white/[0.05] px-4 py-2.5 text-[12px] font-medium text-[#b0b1c4] hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={pending || selectedCount === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-5 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Phone className="h-3.5 w-3.5" />
                  )}
                  {pending ? "Calling..." : "Trigger Call"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
