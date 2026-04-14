import { createClient } from "@/app/lib/supabase/server";
import { Card } from "@/app/components/ui/card";
import { InterviewersSection } from "@/app/components/interviewers-section";
import { HrSenderSection } from "@/app/components/hr-sender-section";
import { getHrSenderStatus } from "@/app/actions/hr-sender";
import {
  Users,
  Mail,
  Phone,
  Headphones,
  Brain,
  Calendar,
  Check,
  AlertCircle,
} from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar_connected?: string; hr_sender_connected?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id || "").single();

  const { data: interviewers } = await supabase
    .from("interviewers")
    .select("id, name, email, timezone, working_hours_start, working_hours_end, is_active, google_connected_at")
    .order("created_at", { ascending: true });

  const hrSenderStatus = await getHrSenderStatus();

  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = profile?.email || user?.email || "";
  const connectedInterviewers = (interviewers || []).filter((i) => i.google_connected_at).length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold text-dark-text">Settings</h1>
        <p className="mt-0.5 text-[13px] text-dark-text-muted">
          Manage your account, integrations, and recruiting team
        </p>
      </div>

      {/* ── Success banners ───────────────────────────────────── */}
      {params.calendar_connected === "1" && (
        <div className="flex items-center gap-3 rounded-xl border border-[#7dd4a8]/20 bg-[#7dd4a8]/[0.05] px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-[#7dd4a8]" />
          <p className="text-[13px] font-medium text-[#7dd4a8]">
            Google Calendar connected successfully
          </p>
        </div>
      )}
      {params.hr_sender_connected === "1" && (
        <div className="flex items-center gap-3 rounded-xl border border-[#7dd4a8]/20 bg-[#7dd4a8]/[0.05] px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-[#7dd4a8]" />
          <p className="text-[13px] font-medium text-[#7dd4a8]">
            HR sender account connected. Emails will now come from this address.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        <div className="space-y-6">
          {/* Profile */}
          <section id="profile" className="scroll-mt-4">
            <Card>
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-[14px] font-bold text-dark-text">Your Profile</h2>
                  <p className="mt-0.5 text-[11px] text-dark-text-muted">
                    Account info from your SalesCode login
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6]/30 to-[#6d28d9]/30 text-[14px] font-bold text-accent">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ProfileField label="Name" value={userName} />
                <ProfileField label="Email" value={userEmail} />
                <ProfileField label="Role" value={profile?.role || "HR Admin"} capitalize />
              </div>
            </Card>
          </section>

          {/* HR Sender */}
          <section id="hr-sender" className="scroll-mt-4">
            <Card>
              <HrSenderSection status={hrSenderStatus} />
            </Card>
          </section>

          {/* Interviewers */}
          <section id="interviewers" className="scroll-mt-4">
            <Card>
              <InterviewersSection interviewers={interviewers || []} />
            </Card>
          </section>

          {/* Integrations */}
          <section id="integrations" className="scroll-mt-4">
            <Card>
              <div className="mb-5">
                <h2 className="text-[14px] font-bold text-dark-text">Integrations</h2>
                <p className="mt-0.5 text-[11px] text-dark-text-muted">
                  External services Neha uses to do her job
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <IntegrationRow
                  icon={Phone}
                  name="Twilio"
                  subtitle="Voice calls"
                  status="configured"
                />
                <IntegrationRow
                  icon={Headphones}
                  name="Deepgram"
                  subtitle="STT + TTS"
                  status="configured"
                />
                <IntegrationRow
                  icon={Brain}
                  name="Claude (Bedrock)"
                  subtitle="AI conversations"
                  status="configured"
                />
                <IntegrationRow
                  icon={Calendar}
                  name="Google Calendar"
                  subtitle={`${connectedInterviewers} interviewer${connectedInterviewers !== 1 ? "s" : ""} connected`}
                  status={connectedInterviewers > 0 ? "configured" : "setup_needed"}
                />
                <IntegrationRow
                  icon={Mail}
                  name="Gmail API (HR Sender)"
                  subtitle={hrSenderStatus.connected ? hrSenderStatus.email || "Connected" : "Not connected — falls back to interviewer"}
                  status={hrSenderStatus.connected ? "configured" : "setup_needed"}
                />
                <IntegrationRow
                  icon={Users}
                  name="Supabase"
                  subtitle="Database + auth"
                  status="configured"
                />
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
        {label}
      </p>
      <p className={`mt-1 text-[13px] font-semibold text-dark-text ${capitalize ? "capitalize" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IntegrationRow({ icon: Icon, name, subtitle, status }: {
  icon: any;
  name: string;
  subtitle: string;
  status: "configured" | "setup_needed";
}) {
  const isOk = status === "configured";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        isOk ? "bg-white/[0.05]" : "bg-[#d4c27d]/10"
      }`}>
        <Icon className={`h-4 w-4 ${isOk ? "text-dark-text-secondary" : "text-[#d4c27d]"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-dark-text">{name}</p>
        <p className="truncate text-[11px] text-dark-text-muted">{subtitle}</p>
      </div>
      {isOk ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#7dd4a8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7dd4a8]">
          <Check className="h-2.5 w-2.5" />
          OK
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#d4c27d]/10 px-2 py-0.5 text-[10px] font-semibold text-[#d4c27d]">
          <AlertCircle className="h-2.5 w-2.5" />
          Setup
        </span>
      )}
    </div>
  );
}
