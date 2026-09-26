import { createClient } from "@/app/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q || q.length < 2) return NextResponse.json({ candidates: [], jobs: [] });

  const supabase = await createClient();
  const like = `%${q}%`;

  const [{ data: cands }, { data: jobs }] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, name, stage, jobs(title)")
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(6),
    supabase
      .from("jobs")
      .select("id, title, status")
      .ilike("title", like)
      .limit(4),
  ]);

  return NextResponse.json({
    candidates: (cands || []).map((c: any) => ({
      id: `c-${c.id}`,
      type: "candidate",
      label: c.name,
      sub: `${(c.jobs as any)?.title || "No role"} · ${c.stage}`,
      href: `/dashboard/candidates/${c.id}`,
    })),
    jobs: (jobs || []).map((j: any) => ({
      id: `j-${j.id}`,
      type: "job",
      label: j.title,
      sub: j.status,
      href: `/dashboard/jobs/${j.id}`,
    })),
  });
}
