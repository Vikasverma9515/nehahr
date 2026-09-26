/**
 * Runs inside the Google Meet tab, injected before Meet's own scripts.
 *
 * It joins the LiveKit room where the Neha agent lives and wires media both ways:
 *
 *   Meet participants' audio ──► mixer ──► published to LiveKit (the agent hears the meeting)
 *   Neha's voice + Tavus video ◄── LiveKit ──► the "microphone" and "camera" Meet sees
 *
 * Meet only ever gets one stable audio track and one stable video track from
 * getUserMedia; what feeds them (placeholder card, Tavus face, Neha's voice)
 * can change underneath without Meet noticing.
 */
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant } from "livekit-client";

type BridgeConfig = {
  livekitUrl: string;
  token: string;
  botName: string;
  width?: number;
  height?: number;
};

declare global {
  interface Window {
    __NEHA_CONFIG?: BridgeConfig;
    __nehaBridge?: ReturnType<typeof createBridge>;
  }
}

function createBridge(cfg: BridgeConfig) {
  const width = cfg.width ?? 1280;
  const height = cfg.height ?? 720;
  const state = {
    livekit: "idle" as "idle" | "connecting" | "connected" | "disconnected" | "failed",
    livekitError: "" as string,
    meetAudioTracks: 0,
    agentAudioTracks: 0,
    avatarVideo: false,
    gumCalls: 0,
    roomEnded: false,
  };

  // ── Audio graph ─────────────────────────────────────────────────────
  const ctx = new AudioContext({ sampleRate: 48000 });
  const toMeet = ctx.createMediaStreamDestination();      // Neha's voice → Meet mic
  const fromMeet = ctx.createMediaStreamDestination();    // Meet's audio → LiveKit
  // Keep the graph alive even when nobody is talking.
  const silence = ctx.createConstantSource();
  const zero = ctx.createGain();
  zero.gain.value = 0;
  silence.connect(zero).connect(toMeet);
  silence.start();
  const resume = () => ctx.state !== "running" && ctx.resume().catch(() => undefined);
  setInterval(resume, 1000);

  // Chrome only feeds remote WebRTC audio into WebAudio if the stream is also
  // attached to a media element, so park each one on a muted <audio>.
  const sinks: HTMLAudioElement[] = [];
  function pipe(track: MediaStreamTrack, into: MediaStreamAudioDestinationNode) {
    const stream = new MediaStream([track]);
    const el = new Audio();
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => undefined);
    sinks.push(el);
    ctx.createMediaStreamSource(stream).connect(into);
  }

  // ── Video: a canvas Meet treats as the camera ───────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  const avatar = document.createElement("video");
  avatar.muted = true;
  avatar.playsInline = true;

  function drawPlaceholder() {
    const grad = g.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#1b1530");
    grad.addColorStop(1, "#4c2fb0");
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = "600 64px sans-serif";
    g.fillText(cfg.botName, width / 2, height / 2);
    g.font = "28px sans-serif";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillText("AI recruiter", width / 2, height / 2 + 52);
  }

  // setInterval, not requestAnimationFrame: rAF stalls in background tabs.
  setInterval(() => {
    if (state.avatarVideo && avatar.readyState >= 2) {
      g.drawImage(avatar, 0, 0, width, height);
    } else {
      drawPlaceholder();
    }
  }, 1000 / 25);
  drawPlaceholder();
  const cameraTrack = canvas.captureStream(25).getVideoTracks()[0];
  const micTrack = toMeet.stream.getAudioTracks()[0];

  // ── Fake devices for Meet ───────────────────────────────────────────
  const md = navigator.mediaDevices;
  const fakeDevices = [
    { deviceId: "neha-mic", kind: "audioinput", label: `${cfg.botName} microphone`, groupId: "neha" },
    { deviceId: "neha-cam", kind: "videoinput", label: `${cfg.botName} camera`, groupId: "neha" },
    { deviceId: "neha-speaker", kind: "audiooutput", label: "Default speaker", groupId: "neha" },
  ].map((d) => ({ ...d, toJSON: () => d })) as unknown as MediaDeviceInfo[];

  md.enumerateDevices = async () => fakeDevices;
  md.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    state.gumCalls++;
    resume();
    const tracks: MediaStreamTrack[] = [];
    if (constraints?.audio) tracks.push(micTrack.clone());
    if (constraints?.video) tracks.push(cameraTrack.clone());
    return new MediaStream(tracks);
  };

  // ── Capture what the meeting says ───────────────────────────────────
  const NativePC = window.RTCPeerConnection;
  const seen = new Set<string>();
  function Wrapped(this: unknown, ...args: ConstructorParameters<typeof RTCPeerConnection>) {
    const pc = new NativePC(...args);
    pc.addEventListener("track", (ev: RTCTrackEvent) => {
      if (ev.track.kind !== "audio" || seen.has(ev.track.id)) return;
      seen.add(ev.track.id);
      // livekit-client builds its peer connections through this same global,
      // so Neha's own voice arrives here too. Never feed it back to LiveKit
      // (the agent would hear itself): LiveKit tracks carry TR_/PA_ ids.
      if (isLiveKitTrack(ev)) return;
      // Belt and braces: re-check once LiveKit has matched its subscriptions.
      setTimeout(() => {
        if (ownTrackIds().has(ev.track.id)) return;
        state.meetAudioTracks++;
        pipe(ev.track, fromMeet);
      }, 300);
    });
    return pc;
  }
  Wrapped.prototype = NativePC.prototype;
  Object.setPrototypeOf(Wrapped, NativePC);
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = Wrapped;

  // ── LiveKit ─────────────────────────────────────────────────────────
  const room = new Room({ adaptiveStream: false, dynacast: false });

  function isLiveKitTrack(ev: RTCTrackEvent): boolean {
    return ev.track.id.startsWith("TR_") || ev.streams.some((st) => /(^|\|)(PA|TR)_/.test(st.id));
  }

  function ownTrackIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        const t = pub.track?.mediaStreamTrack;
        if (t) ids.add(t.id);
      }
    }
    return ids;
  }

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
    // Humans in the LiveKit room (a recruiter watching) must not be echoed into Meet.
    const role = participant.attributes?.role;
    if (role === "recruiter" || role === "tester") return;
    if (track.kind === Track.Kind.Audio) {
      state.agentAudioTracks++;
      pipe(track.mediaStreamTrack, toMeet);
    } else if (track.kind === Track.Kind.Video) {
      avatar.srcObject = new MediaStream([track.mediaStreamTrack]);
      avatar.play().catch(() => undefined);
      state.avatarVideo = true;
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video) state.avatarVideo = false;
  });
  room.on(RoomEvent.Disconnected, () => {
    state.livekit = "disconnected";
    state.roomEnded = true;
  });

  async function connect() {
    state.livekit = "connecting";
    try {
      await room.connect(cfg.livekitUrl, cfg.token, { autoSubscribe: true });
      await room.localParticipant.publishTrack(fromMeet.stream.getAudioTracks()[0], {
        name: "meet-audio",
        source: Track.Source.Microphone,
        dtx: false,
        red: true,
      });
      state.livekit = "connected";
    } catch (e) {
      state.livekit = "failed";
      state.livekitError = String(e);
    }
  }

  return {
    connect,
    status: () => ({ ...state, audioContext: ctx.state }),
    /** Speaker names from Meet's captions, forwarded to the agent as context. */
    sendCaption: (speaker: string, text: string) =>
      room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify({ speaker, text })), {
          reliable: true,
          topic: "meet.captions",
        })
        .catch(() => undefined),
    leave: () => room.disconnect(),
  };
}

// Install once, in the top frame only, before Meet grabs the media APIs.
if (window.top === window && window.__NEHA_CONFIG && !window.__nehaBridge) {
  window.__nehaBridge = createBridge(window.__NEHA_CONFIG);
  void window.__nehaBridge.connect();
}
