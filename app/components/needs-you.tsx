import Link from "next/link";
import { AlertTriangle, Bot, MessageSquare, TrendingDown, UserCheck, Video } from "lucide-react";
import { createClient } from "@/app/lib/supabase/server";
import { ResolveRequestButton } from "@/app/components/resolve-request-button";

type Item = {
  key: string;
  icon: typeof AlertTriangle;
  title: string;
  detail: string;
  href: string;
  action?: React.ReactNode;
  at: string;
};

const REQUEST_LABEL: Record<string, string> = {
  reschedule: "wants to reschedule",
  withdraw: "wants to withdraw",
  question: "asked a question",
  message: "left a message",
  callback: "asked for a callback",
};

function weekAgoIso() {
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

/** Everything waiting on a recruiter, newest first. Tables from newer migrations are optional. */
export async function NeedsYou() {
  const supabase = await createClient();
  const weekAgo = weekAgoIso();

  const [requests, aiDone, atRisk, botFailed, managerCalls] = await Promise.all([
    supabase.from("candidate_requests").select("id, kind, details, caller_number, created_at, candidates(id, name)")
      .eq("status", "open").order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_interviews").select("id, score, summary, completed_at, candidates(id, name, stage)")
      .eq("status", "completed").gte("completed_at", weekAgo).order("completed_at", { ascending: false }).limit(10),
    supabase.from("candidates").select("id, name, engagement_notes, last_engagement_call_at, joining_date")
      .eq("pre_joining_status", "at_risk").limit(10),
    supabase.from("interviews").select("id, scheduled_at, candidates(id, name)")
      .eq("bot_status", "failed").gte("scheduled_at", weekAgo).limit(10),
    supabase.from("candidate_reviews").select("id, decision, note, reviewer_name, created_at, candidates(id, name, stage)")
      .gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(15),
  ]);

  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  const items: Item[] = [];

  for (const r of requests.data || []) {
    const c = one(r.candidates as { id: string; name: string } | { id: string; name: string }[] | null);
    items.push({
      key: `req-${r.id}`, icon: MessageSquare, at: r.created_at,
      title: `${c?.name || r.caller_number || "Unknown caller"} ${REQUEST_LABEL[r.kind] || r.kind}`,
      detail: r.details || "Called the Neha line",
      href: c ? `/dashboard/candidates/${c.id}` : "/dashboard/calls",
      action: <ResolveRequestButton id={r.id} />,
    });
  }
  for (const a of aiDone.data || []) {
    const c = one(a.candidates as { id: string; name: string; stage: string } | { id: string; name: string; stage: string }[] | null);
    if (!c || !["new", "screening", "screened"].includes(c.stage)) continue;
    items.push({
      key: `ai-${a.id}`, icon: Video, at: a.completed_at,
      title: `${c.name} finished the AI video interview${a.score != null ? `: ${a.score}/100` : ""}`,
      detail: a.summary || "Review and decide the next step",
      href: `/dashboard/candidates/${c.id}`,
    });
  }
  for (const c of atRisk.data || []) {
    items.push({
      key: `risk-${c.id}`, icon: TrendingDown, at: c.last_engagement_call_at || new Date(0).toISOString(),
      title: `${c.name} may not join${c.joining_date ? ` on ${c.joining_date}` : ""}`,
      detail: c.engagement_notes || "Flagged at risk on the last check-in call",
      href: `/dashboard/candidates/${c.id}`,
    });
  }
  for (const iv of botFailed.data || []) {
    const c = one(iv.candidates as { id: string; name: string } | { id: string; name: string }[] | null);
    items.push({
      key: `bot-${iv.id}`, icon: Bot, at: iv.scheduled_at,
      title: `Neha couldn't join ${c?.name || "an"}'s Meet interview`,
      detail: "Nobody admitted the bot, or Meet blocked it. Add the bot account to the event or send her again.",
      href: c ? `/dashboard/candidates/${c.id}` : "/dashboard/interviews",
    });
  }

  for (const r of managerCalls.data || []) {
    const c = one(r.candidates as { id: string; name: string; stage: string } | { id: string; name: string; stage: string }[] | null);
    // Advanced candidates now need scheduling; rejects and maybes just need a look.
    if (!c || (r.decision === "advance" && c.stage !== "shortlisted")) continue;
    items.push({
      key: `rev-${r.id}`, icon: UserCheck, at: r.created_at,
      title: `${r.reviewer_name || "Hiring manager"} ${r.decision === "advance" ? "advanced" : r.decision === "reject" ? "rejected" : "is unsure about"} ${c.name}`,
      detail: r.note || (r.decision === "advance" ? "Schedule the interview" : "No note"),
      href: `/dashboard/candidates/${c.id}`,
    });
  }

  if (items.length === 0) return null;
  items.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-dark-text">
        <AlertTriangle className="h-4 w-4 text-amber-400" /> Needs you ({items.length})
      </p>
      <div className="space-y-1.5">
        {items.slice(0, 12).map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.key} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-dark-text-muted" />
              <Link href={it.href} className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-dark-text">{it.title}</p>
                <p className="truncate text-[11px] text-dark-text-muted">{it.detail}</p>
              </Link>
              {it.action}
            </div>
          );
        })}
      </div>
    </div>
  );
}
