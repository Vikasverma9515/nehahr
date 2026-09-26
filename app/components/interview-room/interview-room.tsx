"use client";

import { useState, useTransition } from "react";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  VideoTrack,
  useLocalParticipant,
  useTracks,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { PhoneOff, ShieldCheck } from "lucide-react";
import { joinPublicInterview, type PublicInterview, type RoomJoin } from "@/app/actions/ai-interviews";

export function InterviewRoom({ token, info }: { token: string; info: PublicInterview }) {
  const [join, setJoin] = useState<RoomJoin | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await joinPublicInterview(token, consent);
      if (res.error || !res.join) setError(res.error || "Could not start the interview");
      else setJoin(res.join);
    });
  }

  if (ended) {
    return (
      <div className="card-glass mx-auto mt-16 max-w-lg rounded-2xl p-8 text-center">
        <h1 className="font-display text-[24px]">Thanks, {info.first_name || "there"}</h1>
        <p className="mt-3 text-[14px] text-dark-text-secondary">
          Your interview has ended. If you were disconnected by accident, reopen your link to rejoin.
        </p>
      </div>
    );
  }

  if (join) {
    return (
      <LiveKitRoom serverUrl={join.url} token={join.token} connect audio video onDisconnected={() => setEnded(true)}>
        <RoomAudioRenderer />
        <StartAudio label="Tap to hear Neha" className="btn-primary mb-4 rounded-xl px-4 py-2 text-[13px] text-white" />
        <Stage onLeave={() => setEnded(true)} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="card-glass mx-auto mt-8 max-w-xl rounded-2xl p-8">
      <h1 className="font-display text-[26px]">Hi {info.first_name || "there"}, ready when you are</h1>
      <p className="mt-2 text-[14px] text-dark-text-secondary">
        A first-round interview for <span className="text-dark-text">{info.job_title || "the role"}</span> at{" "}
        {info.company}, with Neha, an AI recruiter. It takes about 15 minutes.
      </p>
      <ul className="mt-5 space-y-2 text-[13px] text-dark-text-secondary">
        <li>• Find a quiet spot and allow camera and microphone access.</li>
        <li>• Speak naturally. You can interrupt Neha or ask her to repeat a question.</li>
        <li>• If you drop out, reopen this link to continue.</li>
      </ul>
      <label className="mt-6 flex items-start gap-3 text-[13px] text-dark-text-secondary">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
          I agree that this conversation is recorded and transcribed, and shared with the {info.company} hiring
          team for this application.
        </span>
      </label>
      {error && <p className="mt-4 rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-dark-text-secondary">{error}</p>}
      <button onClick={start} disabled={!consent || pending}
        className="btn-primary mt-6 w-full rounded-xl px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50">
        {pending ? "Connecting..." : "Start interview"}
      </button>
      <p className="mt-3 text-center text-[11px] text-dark-text-muted">
        Link valid until {new Date(info.expires_at).toLocaleString()} · {info.attempts_left} attempt(s) left
      </p>
    </div>
  );
}

function Stage({ onLeave }: { onLeave: () => void }) {
  const { state, audioTrack, videoTrack, agent } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const cameras = useTracks([Track.Source.Camera]).filter(
    (t) => t.participant.identity === localParticipant.identity,
  );
  const captions = useTranscriptions()
    .filter((t) => t.participantInfo.identity === agent?.identity)
    .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp);
  const latest = captions[captions.length - 1]?.text;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden rounded-2xl bg-black/40">
        {videoTrack ? (
          <VideoTrack trackRef={videoTrack} className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center">
            <BarVisualizer state={state} trackRef={audioTrack} barCount={7} className="h-32 w-2/3" />
          </div>
        )}
        {latest && (
          <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/60 px-4 py-2 text-center text-[14px] text-white">
            {latest}
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
          Neha · AI recruiter · {state}
        </span>
      </div>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl bg-black/40">
          {cameras[0] ? (
            <VideoTrack trackRef={cameras[0]} className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-[12px] text-dark-text-muted">Camera off</div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <TrackToggle source={Track.Source.Microphone} className="rounded-xl bg-white/[0.06] px-4 py-2 text-[13px]" />
          <TrackToggle source={Track.Source.Camera} className="rounded-xl bg-white/[0.06] px-4 py-2 text-[13px]" />
          <button onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/80 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-500">
            <PhoneOff className="h-4 w-4" /> Leave
          </button>
        </div>
        <p className="text-center text-[11px] text-dark-text-muted">Recorded for the hiring team</p>
      </div>
    </div>
  );
}
