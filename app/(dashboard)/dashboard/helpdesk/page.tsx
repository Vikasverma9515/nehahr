import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { EmptyState } from "@/app/components/ui/empty-state";
import { HelpCircle, Clock, MessageSquare, User } from "lucide-react";
import { PersonAvatar } from "@/app/components/person-avatar";
import { ResolveRequestButton } from "@/app/components/resolve-request-button";
import Link from "next/link";

export default async function HelpdeskPage() {
  const supabase = await createClient();

  const [ticketsRes, requestsRes] = await Promise.all([
    supabase
      .from("helpdesk_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("candidate_requests")
      .select("*, candidates(id, name, stage)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const tickets = ticketsRes.data || [];
  const requests = requestsRes.data || [];

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "escalated");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved");
  const openRequests = requests.filter((r) => !r.resolved);
  const resolvedRequests = requests.filter((r) => r.resolved);

  const hasAny = tickets.length > 0 || requests.length > 0;

  return (
    <>
      <PageHeader
        title="Helpdesk"
        description="Candidate requests and employee support tickets"
      />

      {hasAny ? (
        <div className="space-y-8">
          {/* Candidate requests — open */}
          {openRequests.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-accent" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Candidate Requests
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/20 px-1.5 text-[11px] font-bold text-accent">
                  {openRequests.length}
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] divide-y divide-white/[0.06]">
                {openRequests.map((r) => {
                  const candidate = r.candidates as { id: string; name: string; stage: string } | null;
                  return (
                    <div key={r.id} className="flex items-start gap-4 px-4 py-3.5">
                      <PersonAvatar name={candidate?.name || r.candidate_name} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {candidate ? (
                            <Link
                              href={`/dashboard/candidates/${candidate.id}`}
                              className="text-[13px] font-semibold text-dark-text hover:underline"
                            >
                              {candidate.name}
                            </Link>
                          ) : (
                            <span className="text-[13px] font-semibold text-dark-text">
                              {r.candidate_name || "Unknown"}
                            </span>
                          )}
                          {candidate?.stage && (
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-dark-text-muted">
                              {candidate.stage}
                            </span>
                          )}
                        </div>
                        {r.request_text && (
                          <p className="mt-1 text-[12px] leading-relaxed text-dark-text-secondary line-clamp-2">
                            {r.request_text}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-dark-text-muted">
                          <Clock className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ResolveRequestButton id={r.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Employee tickets — open */}
          {openTickets.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-[#8ab4d9]" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Open Tickets
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-bold text-dark-text-muted">
                  {openTickets.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {openTickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            </div>
          )}

          {/* Resolved requests (collapsed) */}
          {(resolvedRequests.length > 0 || resolvedTickets.length > 0) && (
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] text-dark-text-muted hover:text-dark-text-secondary">
                <span className="text-xs">▶</span>
                <span>
                  Resolved ({resolvedRequests.length + resolvedTickets.length})
                </span>
              </summary>
              <div className="mt-3 space-y-4">
                {resolvedRequests.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] divide-y divide-white/[0.04] opacity-60">
                    {resolvedRequests.map((r) => {
                      const candidate = r.candidates as { id: string; name: string } | null;
                      return (
                        <div key={r.id} className="flex items-center gap-4 px-4 py-3">
                          <PersonAvatar name={candidate?.name || r.candidate_name} size={30} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-dark-text-secondary">
                              {candidate?.name || r.candidate_name || "Unknown"}
                            </p>
                            {r.request_text && (
                              <p className="truncate text-[11px] text-dark-text-muted">{r.request_text}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-[#7dd4a8]">Resolved</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {resolvedTickets.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 opacity-60 md:grid-cols-2 xl:grid-cols-3">
                    {resolvedTickets.map((t) => (
                      <TicketCard key={t.id} ticket={t} />
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      ) : (
        <EmptyState
          icon={HelpCircle}
          art="sitting-2"
          title="No open tickets"
          description="Candidate requests and employee support tickets will appear here"
        />
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TicketCard({ ticket: t }: { ticket: any }) {
  const statusColor: Record<string, string> = {
    open: "text-[#d4c27d] bg-[#d4c27d]/10",
    escalated: "text-[#e8908a] bg-[#e8908a]/10",
    resolved: "text-[#7dd4a8] bg-[#7dd4a8]/10",
  };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <PersonAvatar name={t.employee_name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-dark-text">
            {t.employee_name || "Unknown"}
          </p>
          <p className="mt-0.5 text-[12px] capitalize text-dark-text-secondary">
            {t.bucket?.replace(/_/g, " ") || "General"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusColor[t.status] || "bg-white/[0.06] text-dark-text-secondary"}`}>
          {t.status}
        </span>
      </div>
      {t.query_text && (
        <p className="mt-2 text-[11px] leading-relaxed text-dark-text-muted line-clamp-2">
          {t.query_text}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1 text-[10px] text-dark-text-muted">
        <Clock className="h-3 w-3" />
        {new Date(t.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </div>
    </div>
  );
}
