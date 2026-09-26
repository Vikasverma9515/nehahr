// Stand-in for a Google Meet tab: grabs camera + mic through getUserMedia (the
// bridge answers), and receives "another participant's" 880 Hz audio over a
// real RTCPeerConnection, like Meet does.
import { dominantFrequency } from "./freq";

type Result = {
  devices: string[];
  micHz: number;
  micLevel: number;
  videoWidth: number;
  videoFrames: number;
  remoteSent: boolean;
};
const w = window as unknown as { meetingResult: Result };
w.meetingResult = { devices: [], micHz: 0, micLevel: -Infinity, videoWidth: 0, videoFrames: 0, remoteSent: false };

const ctx = new AudioContext();

const devices = await navigator.mediaDevices.enumerateDevices();
w.meetingResult.devices = devices.map((d) => `${d.kind}:${d.label}`);

const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
dominantFrequency(ctx, media, (hz, level) => {
  w.meetingResult.micHz = hz;
  w.meetingResult.micLevel = level;
});
const video = document.createElement("video");
video.muted = true;
video.srcObject = new MediaStream(media.getVideoTracks());
await video.play();
const countFrames = () => {
  w.meetingResult.videoWidth = video.videoWidth;
  w.meetingResult.videoFrames++;
  video.requestVideoFrameCallback(countFrames);
};
video.requestVideoFrameCallback(countFrames);

// "Another participant" speaking at 880 Hz, delivered over WebRTC loopback.
const osc = ctx.createOscillator();
osc.frequency.value = 880;
const dest = ctx.createMediaStreamDestination();
osc.connect(dest);
osc.start();
const pc1 = new RTCPeerConnection();
const pc2 = new RTCPeerConnection();   // wrapped by the bridge
pc1.onicecandidate = (e) => e.candidate && pc2.addIceCandidate(e.candidate);
pc2.onicecandidate = (e) => e.candidate && pc1.addIceCandidate(e.candidate);
pc1.addTrack(dest.stream.getAudioTracks()[0], dest.stream);
await pc1.setLocalDescription(await pc1.createOffer());
await pc2.setRemoteDescription(pc1.localDescription!);
await pc2.setLocalDescription(await pc2.createAnswer());
await pc1.setRemoteDescription(pc2.localDescription!);
w.meetingResult.remoteSent = true;
