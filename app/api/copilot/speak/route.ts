import { createSpeakHandler } from "@cairnvibe/sdk/speak-server";
import { guard } from "@/app/lib/cairn";

// Multi-step tasks may wait out a provider rate limit; allow the hosting platform to run that long.
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const handler = createSpeakHandler({ apiKey: process.env.DEEPGRAM_API_KEY ?? "" });
  const { text } = await request.json().catch(() => ({ text: "" }));
  const result = await handler(text ?? "");
  if ("error" in result.body) return Response.json(result.body, { status: result.status });
  return new Response(result.body.stream, { status: result.status, headers: { "content-type": result.body.contentType } });
}
