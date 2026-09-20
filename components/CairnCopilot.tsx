"use client";

import { Copilot } from "@cairnvibe/sdk";

// A client wrapper: the dashboard layout is a server component and cannot pass a function prop.
// Typed chat plus push-to-talk (mic button) and spoken answers, all through Neha's own signed-in API routes.
// Live voice conversation ("realtime") needs the always-on relay (`npm run dev` starts it next to Next.js).
// It appears only when NEXT_PUBLIC_CAIRN_REALTIME_URL is set, because serverless hosting cannot hold a
// WebSocket open, so the deployed site shows push-to-talk only until the relay is hosted somewhere.
export function CairnCopilot() {
  const realtimeUrl = process.env.NEXT_PUBLIC_CAIRN_REALTIME_URL || undefined;
  return (
    <Copilot
      registeredActions={[]}
      onDo={() => {}}
      planEndpoint="/api/copilot/plan"
      criticEndpoint="/api/copilot/critic"
      skillsSaveEndpoint="/api/copilot/skills/save"
      transcribeEndpoint="/api/copilot/transcribe"
      speakEndpoint="/api/copilot/speak"
      realtimeUrl={realtimeUrl}
      persona="Neha Assistant"
    />
  );
}
