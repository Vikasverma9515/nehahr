"use client";

import { useState, useTransition } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Hand, Undo2 } from "lucide-react";
import { observeAiInterview, type RoomJoin } from "@/app/actions/ai-interviews";

export function WatchRoom({ interviewId, status }: { interviewId: string; status: string }) {
  const [join, setJoin] = useState<RoomJoin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status !== "in_progress") {
    return <p className="text-[13px] text-dark-text-muted">This interview is {status.replace("_", " ")}, so there is nothing live to watch.</p>;
  }
  if (!join) {
    return (
      <div>
        <button disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await observeAiInterview(interviewId);
            if (res.error || !res.join) setError(res.error || "Could not join");
            else setJoin(res.join);
          })}
          className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? "Joining..." : "Join silently"}
        </button>
        {error && <p className="mt-3 text-[13px] text-dark-text-secondary">{error}</p>}
      </div>
    );
  }
  return (
    <LiveKitRoom serverUrl={join.url} token={join.token} connect audio={false} video={false}>
      <RoomAudioRenderer />
      <StartAudio label="Click to hear the interview" className="btn-primary mb-4 rounded-xl px-4 py-2 text-[12px] text-white" />
      <Observer />
    </LiveKitRoom>
  );
}

function Observer() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { videoTrack, agent, state } = useVoiceAssistant();
  const [takenOver, setTakenOver] = useState(false);
  const candidateCam = useTracks([Track.Source.Camera]).find(
    (t) => t.participant.attributes?.role === "candidate",
  );
  const lines = useTranscriptions().sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp).slice(-30);

  async function setControl(action: "pause" | "resume") {
    await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ action })), {
      reliable: true,
      topic: "neha.control",
    });
  }

  async function takeOver() {
    await setControl("pause");
    await localParticipant.setMicrophoneEnabled(true);
    await localParticipant.setCameraEnabled(true).catch(() => null);
    setTakenOver(true);
  }

  async function handBack() {
    await localParticipant.setMicrophoneEnabled(false);
    await localParticipant.setCameraEnabled(false).catch(() => null);
    await setControl("resume");
    setTakenOver(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_340px]">
      <Tile label={`Neha · ${takenOver ? "paused" : state}`}>
        {videoTrack ? <VideoTrack trackRef={videoTrack} className="aspect-video w-full object-cover" /> : null}
      </Tile>
      <Tile label="Candidate">
        {candidateCam ? <VideoTrack trackRef={candidateCam} className="aspect-video w-full object-cover" /> : null}
      </Tile>
      <div className="space-y-3">
        {takenOver ? (
          <button onClick={handBack} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-dark-text">
            <Undo2 className="h-4 w-4" /> Hand back to Neha
          </button>
        ) : (
          <button onClick={takeOver} className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white">
            <Hand className="h-4 w-4" /> Take over
          </button>
        )}
        <div className="card-glass max-h-[420px] space-y-1.5 overflow-y-auto rounded-2xl p-4">
          {lines.map((l) => (
            <p key={l.streamInfo.id} className="text-[12px] text-dark-text-secondary">
              <span className="font-semibold text-dark-text">{l.participantInfo.identity === agent?.identity ? "Neha" : "Candidate"}:</span>{" "}
              {l.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/40">
      {children || <div className="flex aspect-video items-center justify-center text-[12px] text-dark-text-muted">No video</div>}
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">{label}</span>
    </div>
  );
}
