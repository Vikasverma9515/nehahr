import { NextResponse } from "next/server";
import { createCriticLLM, createPlanLLM, createVerbLLM, KeyRotator } from "@cairnvibe/sdk/server";
import { ManifestSchema } from "@cairnvibe/core";
import { AUTH_DISABLED, createClient } from "@/app/lib/supabase/server";
import { createSeededSkillStore } from "@/app/lib/cairn-skills";
// `npm run cairn:build` regenerates this. Importing it (not reading from disk) bundles it into the function.
import rawManifest from "../../.cairn/ui-manifest.json";

export const manifest = ManifestSchema.parse(rawManifest);

// Providers' free and low tiers cap requests per minute (Gemini free: 15). A multi-step task can touch
// that mid-way, so let the SDK wait out a limit of up to ~50s instead of failing the task. The routes
// below set maxDuration = 60 so the hosting platform allows the wait.
process.env.CAIRN_MAX_RATE_WAIT_MS ??= "50000";

/**
 * The assistant works the real buttons (click, fill, select), so "act" is the tier that lets it finish
 * a task instead of stopping at the page. Irreversible steps are protected twice: the app itself asks
 * for confirmation (Reject, Delete and Send email all open a confirm step), and the
 * "irreversible-actions" skill tells the agent to ask the person in chat before it presses them.
 */
export const registeredActions: string[] = [];
export const capability = (process.env.CAIRN_CAPABILITY as "explain" | "guide" | "act" | undefined) ?? "act";
export const persona = process.env.CAIRN_PERSONA || "Neha Assistant";

export const skills = createSeededSkillStore();
export const SKILLS_SCOPE_ID = "neha-hr";

type Provider = "anthropic" | "groq" | "gemini";
function pickProvider(): Provider | null {
  const wanted = process.env.CAIRN_RUNTIME_PROVIDER as Provider | undefined;
  const has = { groq: !!process.env.GROQ_API_KEYS, gemini: !!(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY), anthropic: !!process.env.ANTHROPIC_API_KEY };
  if (wanted && has[wanted]) return wanted;
  return (["gemini", "anthropic", "groq"] as const).find((p) => has[p]) ?? null;
}

export const provider = pickProvider();
// One rotator shared by all three roles, so a dead key is learned once.
const keyRotator =
  provider === "groq"
    ? (KeyRotator.fromEnvList(process.env.GROQ_API_KEYS) ?? undefined)
    : provider === "gemini"
      ? (KeyRotator.fromEnvList(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY) ?? undefined)
      : undefined;

export const verbLLM = provider ? createVerbLLM({ provider, registeredActions, keyRotator }) : null;
export const planLLM = provider ? createPlanLLM({ provider, keyRotator }) : null;
export const criticLLM = provider ? createCriticLLM({ provider, keyRotator }) : null;

/** Null when the caller may use the assistant, otherwise the error response to return. */
export async function guard(): Promise<NextResponse | null> {
  if (!AUTH_DISABLED) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  }
  if (!provider) {
    return NextResponse.json({ error: "The assistant needs an LLM key: set GEMINI_API_KEY, ANTHROPIC_API_KEY or GROQ_API_KEYS." }, { status: 503 });
  }
  return null;
}
