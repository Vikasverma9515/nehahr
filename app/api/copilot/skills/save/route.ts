import { NextResponse } from "next/server";
import { createSkillSaveHandler } from "@cairnvibe/sdk/server";
import { guard, skills, SKILLS_SCOPE_ID } from "@/app/lib/cairn";

const handler = createSkillSaveHandler(skills, SKILLS_SCOPE_ID);

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const result = await handler(await request.json().catch(() => null));
  return NextResponse.json(result.body, { status: result.status });
}
