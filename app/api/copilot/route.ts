import { NextResponse } from "next/server";
import { createCopilotHandlerWithLLM } from "@cairnvibe/sdk/server";
import { capability, guard, manifest, persona, registeredActions, verbLLM } from "@/app/lib/cairn";

// Multi-step tasks may wait out a provider rate limit; allow the hosting platform to run that long.
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const handler = createCopilotHandlerWithLLM(manifest, verbLLM!, { registeredActions, capability, persona });
  const result = await handler(await request.json().catch(() => null));
  return NextResponse.json(result.body, { status: result.status });
}
