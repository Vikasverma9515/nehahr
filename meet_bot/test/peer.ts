// Stand-in for the Neha agent in the bridge test: plays a 440 Hz tone into the
// room and reports the loudest frequency it hears from the bridge.
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { dominantFrequency } from "./freq";

const params = new URLSearchParams(location.hash.slice(1));
const w = window as unknown as { peerResult: { connected: boolean; heardHz: number; heardLevel: number } };
w.peerResult = { connected: false, heardHz: 0, heardLevel: -Infinity };

const ctx = new AudioContext();
const osc = ctx.createOscillator();
osc.frequency.value = 440;
const dest = ctx.createMediaStreamDestination();
osc.connect(dest);
osc.start();

const room = new Room();
room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
  if (track.kind !== Track.Kind.Audio) return;
  const stream = new MediaStream([track.mediaStreamTrack]);
  const el = new Audio();
  el.muted = true;
  el.srcObject = stream;
  el.play().catch(() => undefined);
  dominantFrequency(ctx, stream, (hz, level) => {
    w.peerResult.heardHz = hz;
    w.peerResult.heardLevel = level;
  });
});
await room.connect(params.get("url")!, params.get("token")!);
await room.localParticipant.publishTrack(dest.stream.getAudioTracks()[0], { source: Track.Source.Microphone });
w.peerResult.connected = true;
