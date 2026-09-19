import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { EmptyState } from "@/app/components/ui/empty-state";
import { HelpCircle, Clock } from "lucide-react";
import { PersonAvatar } from "@/app/components/person-avatar";

export default async function HelpdeskPage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("helpdesk_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Group by status
  const open = (tickets || []).filter(
    (t) => t.status === "open" || t.status === "escalated"
  );
  const resolved = (tickets || []).filter((t) => t.status === "resolved");

  return (
    <>
      <PageHeader
        title="Helpdesk"
        description="Employee support tickets"
      />

      {tickets && tickets.length > 0 ? (
        <div className="space-y-8">
          {open.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Open
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-bold text-dark-text-muted">
                  {open.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {open.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dark-text-secondary">
                  Resolved
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-bold text-dark-text-muted">
                  {resolved.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {resolved.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={HelpCircle}
          art="sitting-2"
          title="No tickets"
          description="Employee helpdesk tickets will appear here"
        />
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TicketCard({ ticket: t }: { ticket: any }) {
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
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-dark-text-secondary">
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
