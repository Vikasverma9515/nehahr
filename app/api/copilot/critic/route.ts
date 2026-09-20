import { NextResponse } from "next/server";
import { createCriticHandlerWithLLM } from "@cairnvibe/sdk/server";
import { criticLLM, guard } from "@/app/lib/cairn";

// Multi-step tasks may wait out a provider rate limit; allow the hosting platform to run that long.
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const handler = createCriticHandlerWithLLM(criticLLM!);
  const result = await handler(await request.json().catch(() => null));
  return NextResponse.json(result.body, { status: result.status });
}
