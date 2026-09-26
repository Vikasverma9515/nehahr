// Shape of the in-page bridge (src/bridge/bridge.ts) as seen from Playwright.
type BridgeStatus = {
  livekit: "idle" | "connecting" | "connected" | "disconnected" | "failed";
  livekitError: string;
  meetAudioTracks: number;
  agentAudioTracks: number;
  avatarVideo: boolean;
  gumCalls: number;
  roomEnded: boolean;
  audioContext: string;
};

interface Window {
  __nehaBridge?: {
    status(): BridgeStatus;
    sendCaption(speaker: string, text: string): Promise<void>;
    leave(): Promise<void>;
  };
}
