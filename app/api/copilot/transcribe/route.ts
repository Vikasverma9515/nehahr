import { NextResponse } from "next/server";
import { createTranscribeHandler } from "@cairnvibe/sdk/transcribe-server";
import { guard } from "@/app/lib/cairn";

// Multi-step tasks may wait out a provider rate limit; allow the hosting platform to run that long.
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const handler = createTranscribeHandler({ apiKey: process.env.DEEPGRAM_API_KEY ?? "" });
  const result = await handler(await request.arrayBuffer(), request.headers.get("content-type") ?? "audio/webm");
  return NextResponse.json(result.body, { status: result.status });
}
