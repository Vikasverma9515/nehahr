import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createCopilotHandler } from "@cairnvibe/sdk/server";
import { ManifestSchema, type Manifest } from "@cairnvibe/core";

function loadManifest(): Manifest {
  const manifestPath = path.join(process.cwd(), "ui-manifest.json");
  if (fs.existsSync(manifestPath)) {
    return ManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  }
  console.warn("[cairn] no ui-manifest.json — run `npx cairn build .` first. Serving an empty manifest.");
  return { version: "1", commit: "unbuilt", generatedAt: new Date().toISOString(), pages: [], dead: [], conflicts: [] };
}

export async function POST(request: Request) {
  const handler = createCopilotHandler(loadManifest(), {
    provider: process.env.CAIRN_RUNTIME_PROVIDER === "anthropic" ? "anthropic" : "groq",
    registeredActions: (process.env.CAIRN_REGISTERED_ACTIONS ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    capability: (process.env.CAIRN_CAPABILITY as "explain" | "guide" | "act" | undefined) ?? "act",
    persona: process.env.CAIRN_PERSONA || undefined,
  });
  const body = await request.json().catch(() => null);
  const result = await handler(body);
  return NextResponse.json(result.body, { status: result.status });
}
