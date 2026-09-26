"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  VideoTrack,
  useDataChannel,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { AudioLines, PhoneOff, Play, Video } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import {
  endPlaygroundSession,
  startPlaygroundSession,
  type PlaygroundSession,
} from "@/app/actions/playground";

type CandidateOption = { id: string; name: string; job: string };

const CALL_TYPES = [
  { value: "screening", label: "Screening" },
  { value: "scheduling", label: "Scheduling" },
  { value: "reminder", label: "Interview reminder" },
  { value: "result", label: "Result" },
  { value: "pre_joining", label: "Pre-joining" },
  { value: "engagement", label: "Engagement check-in" },
];

const VOICES = [
  { value: "", label: "Default voice" },
  { value: "cartesia", label: "Cartesia Sonic 3" },
  { value: "elevenlabs", label: "ElevenLabs Flash" },
  { value: "deepgram", label: "Deepgram Aura 2" },
];

const TARGET_MS = 800;

export function Playground({ candidates }: { candidates: CandidateOption[] }) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id || "");
  const [callType, setCallType] = useState("screening");
  const [tts, setTts] = useState("");
  const [avatar, setAvatar] = useState(false);
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startPlaygroundSession({ candidateId, callType, tts, avatar });
      if (res.error || !res.session) setError(res.error || "Could not start the session");
      else setSession(res.session);
    });
  }

  function stop() {
    if (!session) return;
    const callId = session.call_id;
    setSession(null);
    setLastCallId(callId);
    void endPlaygroundSession(callId);
  }

  if (session) {
    return (
      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect
        audio
        video={false}
        onDisconnected={stop}
        className="block"
      >
        <RoomAudioRenderer />
        <StartAudio label="Click to hear Neha" className="btn-primary mb-4 rounded-xl px-4 py-2 text-[12px] text-white" />
        <LiveSession callType={callType} onEnd={stop} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card>
        <h2 className="text-[14px] font-bold text-dark-text">New test conversation</h2>
        <p className="mt-0.5 text-[11px] text-dark-text-muted">
          Uses the same agent that phones candidates. Allow microphone access when asked.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Candidate profile">
            <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}
              className="block w-full rounded-lg px-3 py-2 text-[13px]">
              {candidates.length === 0 && <option value="">Add a candidate first</option>}
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.job ? ` · ${c.job}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Call type">
            <select value={callType} onChange={(e) => setCallType(e.target.value)}
              className="block w-full rounded-lg px-3 py-2 text-[13px]">
              {CALL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Voice">
            <select value={tts} onChange={(e) => setTts(e.target.value)}
              className="block w-full rounded-lg px-3 py-2 text-[13px]">
              {VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-dark-text-secondary">
            <input type="checkbox" checked={avatar} onChange={(e) => setAvatar(e.target.checked)} />
            <Video className="h-3.5 w-3.5" /> Show Neha&apos;s face (Tavus)
          </label>
          {error && (
            <div className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-dark-text-secondary">{error}</div>
          )}
          <button onClick={start} disabled={pending || !candidateId}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            <Play className="h-3.5 w-3.5" />
            {pending ? "Starting..." : "Start talking"}
          </button>
          {lastCallId && (
            <p className="text-[12px] text-dark-text-muted">
              Last session saved.{" "}
              <Link href={`/dashboard/calls/${lastCallId}`} className="text-accent hover:underline">
                Open transcript and score
              </Link>
            </p>
          )}
        </div>
      </Card>
      <Card>
        <h2 className="text-[14px] font-bold text-dark-text">What to try</h2>
        <ul className="mt-3 space-y-2 text-[13px] text-dark-text-secondary">
          <li>Interrupt Neha mid-sentence: she should stop and listen.</li>
          <li>Pause to think (&quot;hmm, my notice is... sixty days&quot;): she should wait, not jump in.</li>
          <li>Switch to Hindi or Hinglish halfway through.</li>
          <li>Give CTC in odd forms: &quot;thirty thousand a month&quot;, &quot;twelve plus two&quot;.</li>
          <li>Ask to be called back tomorrow evening, or to speak to a human.</li>
          <li>Watch the latency panel: each turn should stay under {TARGET_MS} ms.</li>
        </ul>
      </Card>
    </div>
  );
}

type LiveState = {
  extracted?: Record<string, unknown>;
  confirmed_slot_id?: number | null;
  agent_state?: string;
  latency?: LatencyRow[];
  latency_summary?: { turns?: number; p50_ms?: number; p95_ms?: number; max_ms?: number };
};

type LatencyRow = {
  speech_id: string;
  eou_ms?: number;
  transcription_ms?: number;
  llm_ttft_ms?: number;
  tts_ttfb_ms?: number;
  total_ms?: number;
};

function LiveSession({ callType, onEnd }: { callType: string; onEnd: () => void }) {
  const { state, audioTrack, videoTrack, agent } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const [live, setLive] = useState<LiveState>({});

  useDataChannel("neha.state", (msg) => {
    try {
      const next = JSON.parse(new TextDecoder().decode(msg.payload)) as LiveState;
      setLive((prev) => ({ ...prev, ...next }));
    } catch {
      // ignore malformed packets
    }
  });

  const lines = useMemo(
    () =>
      [...transcriptions]
        .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp)
        .map((t) => ({
          id: t.streamInfo.id,
          text: t.text,
          fromAgent: t.participantInfo.identity === agent?.identity,
          isLocal: t.participantInfo.identity === localParticipant.identity,
        })),
    [transcriptions, agent?.identity, localParticipant.identity],
  );

  const extracted = Object.entries(live.extracted || {}).filter(([k]) => !k.startsWith("_"));
  const summary = live.latency_summary || {};

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-dark-text-muted">
                {CALL_TYPES.find((t) => t.value === callType)?.label} call
              </p>
              <p className="mt-1 text-[13px] text-dark-text">
                Neha is <span className="font-semibold">{state}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TrackToggle source={Track.Source.Microphone}
                className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] text-dark-text-secondary" />
              <button onClick={onEnd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/80 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500">
                <PhoneOff className="h-3.5 w-3.5" /> End
              </button>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center">
            {videoTrack ? (
              <VideoTrack trackRef={videoTrack} className="aspect-video w-full max-w-xl rounded-xl" />
            ) : (
              <BarVisualizer state={state} trackRef={audioTrack} barCount={7}
                className="h-28 w-full max-w-md" options={{ minHeight: 8 }} />
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-dark-text">
            <AudioLines className="h-4 w-4" /> Live transcript
          </h3>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {lines.length === 0 && <p className="text-[12px] text-dark-text-muted">Waiting for Neha to speak...</p>}
            {lines.map((l) => (
              <div key={l.id} className={l.fromAgent ? "pr-10" : "pl-10 text-right"}>
                <span className={
                  "inline-block rounded-xl px-3 py-2 text-[13px] " +
                  (l.fromAgent ? "bg-white/[0.05] text-dark-text" : "bg-accent/20 text-dark-text")
                }>
                  {l.text}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <h3 className="text-[13px] font-bold text-dark-text">Latency</h3>
          <p className="mt-0.5 text-[11px] text-dark-text-muted">
            Candidate stops talking → Neha&apos;s first audio. Target under {TARGET_MS} ms.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="p50" value={summary.p50_ms} />
            <Stat label="p95" value={summary.p95_ms} />
            <Stat label="turns" value={summary.turns} raw />
          </div>
          <table className="mt-4 w-full text-[11px]">
            <thead className="text-dark-text-muted">
              <tr>
                <th className="text-left font-normal">Turn</th>
                <th className="text-right font-normal">End of turn</th>
                <th className="text-right font-normal">LLM</th>
                <th className="text-right font-normal">TTS</th>
                <th className="text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {(live.latency || []).map((r, i) => (
                <tr key={r.speech_id} className="text-dark-text-secondary">
                  <td>{i + 1}</td>
                  <td className="text-right">{r.eou_ms ?? "–"}</td>
                  <td className="text-right">{r.llm_ttft_ms ?? "–"}</td>
                  <td className="text-right">{r.tts_ttfb_ms ?? "–"}</td>
                  <td className={"text-right font-semibold " + ((r.total_ms ?? 0) > TARGET_MS ? "text-amber-400" : "text-emerald-400")}>
                    {r.total_ms ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="text-[13px] font-bold text-dark-text">Captured so far</h3>
          {extracted.length === 0 ? (
            <p className="mt-2 text-[12px] text-dark-text-muted">Nothing yet. Fields appear as Neha records them.</p>
          ) : (
            <dl className="mt-3 space-y-2">
              {extracted.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.08em] text-dark-text-muted">{k.replaceAll("_", " ")}</dt>
                  <dd className="text-[12px] text-dark-text">{formatValue(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, raw }: { label: string; value?: number; raw?: boolean }) {
  const bad = !raw && value !== undefined && value > TARGET_MS;
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.08em] text-dark-text-muted">{label}</p>
      <p className={"text-[16px] font-semibold " + (raw ? "text-dark-text" : bad ? "text-amber-400" : "text-emerald-400")}>
        {value === undefined ? "–" : raw ? value : `${value} ms`}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "object" && x ? `${(x as { question?: string }).question}: ${(x as { answer?: string }).answer} (${(x as { rating?: number }).rating}/5)` : String(x)))
      .join(" · ");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${x}`).join(", ");
  }
  return String(v);
}
