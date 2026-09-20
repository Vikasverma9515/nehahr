import { NextResponse } from "next/server";
import { createCopilotHandler } from "@cairnvibe/sdk/server";
import { ManifestSchema } from "@cairnvibe/core";
import { AUTH_DISABLED, createClient } from "@/app/lib/supabase/server";
// `npm run build` regenerates this with `cairn build` when an LLM key is configured. Importing it
// (instead of reading it from disk) makes sure it is bundled into the serverless function.
import rawManifest from "../../../.cairn/ui-manifest.json";

const manifest = ManifestSchema.parse(rawManifest);

type Provider = "anthropic" | "groq" | "gemini";

function pickProvider(): Provider | null {
  const wanted = process.env.CAIRN_RUNTIME_PROVIDER as Provider | undefined;
  if (wanted === "groq" && process.env.GROQ_API_KEYS) return "groq";
  if (wanted === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (wanted === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEYS) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export async function POST(request: Request) {
  // Only signed-in users may talk to the assistant (it spends the LLM key and can see the page).
  if (!AUTH_DISABLED) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  }

  const provider = pickProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "The assistant needs an LLM key: set GROQ_API_KEYS, GEMINI_API_KEY or ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const handler = createCopilotHandler(manifest, {
    provider,
    // The agent may walk people around and click, but it runs no custom actions.
    // Reject / Send offer stay a human click.
    registeredActions: [],
    capability: (process.env.CAIRN_CAPABILITY as "explain" | "guide" | "act" | undefined) ?? "guide",
    persona: process.env.CAIRN_PERSONA || "Neha Assistant",
  });
  const body = await request.json().catch(() => null);
  const result = await handler(body);
  return NextResponse.json(result.body, { status: result.status });
}
