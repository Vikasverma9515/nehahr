import { createClient } from "@/app/lib/supabase/server";

/** Returns counts for sidebar notification dots. Server component — called from layout. */
export async function getSidebarBadges(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: actionCandidates },
      { count: pendingRequests },
      { count: todayInterviews },
      { count: liveAiInterviews },
    ] = await Promise.all([
      // Candidates needing action: qualified screened + needs_manual_scheduling
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .or("and(stage.eq.screened,qualification_status.eq.qualified),needs_manual_scheduling.eq.true"),
      // Open candidate requests
      supabase
        .from("candidate_requests")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
      // Today's interviews
      supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lte("scheduled_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString()),
      // Live AI interviews
      supabase
        .from("ai_interviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
    ]);

    return {
      candidates: actionCandidates || 0,
      helpdesk: pendingRequests || 0,
      interviews: todayInterviews || 0,
      "ai-interviews": liveAiInterviews || 0,
    };
  } catch {
    return {};
  }
}
