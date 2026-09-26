import { createClient } from "@/app/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { ids, action } = await req.json() as { ids: string[]; action: string };
  if (!ids?.length || !action) return NextResponse.json({ error: "Missing ids or action" }, { status: 400 });

  const supabase = await createClient();

  if (action === "screen") {
    // Enqueue screening calls via backend
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/calls/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SERVICE_KEY || ""}` },
          body: JSON.stringify({ candidate_id: id, call_type: "screening" }),
        })
      )
    );
    const count = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ count, message: `Queued ${count} screening call${count !== 1 ? "s" : ""}` });
  }

  if (action === "shortlist") {
    await supabase
      .from("candidates")
      .update({ stage: "shortlisted" })
      .in("id", ids)
      .in("stage", ["screened"]);
    return NextResponse.json({ count: ids.length, message: `Shortlisted ${ids.length} candidate${ids.length !== 1 ? "s" : ""}` });
  }

  if (action === "reject") {
    await supabase
      .from("candidates")
      .update({ stage: "rejected", qualification_status: "unqualified" })
      .in("id", ids);
    return NextResponse.json({ count: ids.length, message: `Rejected ${ids.length} candidate${ids.length !== 1 ? "s" : ""}` });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
