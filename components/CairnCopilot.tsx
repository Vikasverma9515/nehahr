"use client";

import { Copilot } from "@cairnvibe/sdk";

// A small client wrapper so the layout/app file (a server component, for
// metadata etc.) never has to pass a function prop across the server/client
// boundary — see the comment in inject-widget.ts for why that fails.
export function CairnCopilot() {
  return (
    <Copilot
      registeredActions={[]}
      onDo={(action, target) => {
        // run it through your own auth
      }}
    />
  );
}
