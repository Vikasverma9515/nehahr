"use client";

import { Copilot } from "@cairnvibe/sdk";

// A client wrapper: the dashboard layout is a server component and cannot pass a function prop.
// Typed chat plus push-to-talk (mic button) and spoken answers, all through Neha's own signed-in API routes.
export function CairnCopilot() {
  return (
    <Copilot
      registeredActions={[]}
      onDo={() => {}}
      planEndpoint="/api/copilot/plan"
      criticEndpoint="/api/copilot/critic"
      skillsSaveEndpoint="/api/copilot/skills/save"
      transcribeEndpoint="/api/copilot/transcribe"
      speakEndpoint="/api/copilot/speak"
      persona="Neha Assistant"
    />
  );
}
