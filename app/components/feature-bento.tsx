import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck,
  Check,
  ClipboardCheck,
  LifeBuoy,
  Link2,
  PhoneCall,
  Target,
  UserCheck,
} from "lucide-react";
import { Avatar, Waveform } from "@/app/components/landing-visuals";

/* ------------------------------------------------------------------ */
/* Card shell                                                          */
/* ------------------------------------------------------------------ */

function BentoCard({
  icon: Icon,
  title,
  body,
  span,
  side = false,
  children,
}: {
  icon: typeof PhoneCall;
  title: string;
  body: string;
  span: string;
  side?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`group relative flex overflow-hidden rounded-3xl border border-dark-border bg-gradient-to-b from-white/[0.035] to-dark-card p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/30 ${
        side ? "flex-col gap-6 md:flex-row md:items-center md:gap-8" : "flex-col gap-5"
      } ${span}`}
    >
      {/* hover glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/15 opacity-0 blur-3xl transition duration-500 group-hover:opacity-100" />

      <div className={`relative ${side ? "md:w-[42%]" : ""}`}>
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted ring-1 ring-accent/20">
          <Icon className="h-5 w-5 text-accent" />
        </span>
        <h3 className="text-[16px] font-semibold text-dark-text">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-dark-text-muted">{body}</p>
      </div>

      <div className={`relative ${side ? "md:flex-1" : "mt-auto"}`}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini visuals                                                        */
/* ------------------------------------------------------------------ */

function ScreeningVisual() {
  const captured = [
    ["Location", "Pune"],
    ["Notice period", "60 days"],
    ["Expected CTC", "25–30 LPA"],
    ["Work model", "Hybrid ✓"],
  ];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="flex items-center gap-3">
        <Avatar name="Priya Patel" tone={4} className="h-10 w-10 text-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-dark-text">Priya Patel</p>
          <p className="flex items-center gap-1.5 text-[11px] text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Screening call · 02:47
          </p>
        </div>
        <PhoneCall className="h-4 w-4 text-success" />
      </div>
      <Waveform bars={44} className="my-3" />
      <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-[11.5px] italic text-dark-text-secondary">
        &ldquo;I can join after a 60-day notice, and hybrid works for me.&rdquo;
      </p>
      <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">Captured automatically</p>
      <div className="grid grid-cols-2 gap-2">
        {captured.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-accent/15 bg-accent-muted px-3 py-2">
            <p className="text-[9.5px] uppercase tracking-wider text-purple-300/70">{k}</p>
            <p className="text-[12px] font-semibold text-purple-100">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoringVisual() {
  const r = 34;
  const c = 2 * Math.PI * r;
  const score = 92;
  const rows = [
    ["Location", 95],
    ["Experience", 95],
    ["CTC fit", 90],
  ] as const;
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="url(#scoreGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
          />
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c4b5fd" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] leading-none text-dark-text">{score}</span>
          <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-success">Qualified</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-[10.5px] text-dark-text-muted">
              <span>{k}</span>
              <span className="text-dark-text-secondary">{v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-300" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulingVisual() {
  const slots = [
    { t: "Tue · 3:00 PM", chosen: true },
    { t: "Wed · 11:30 AM" },
    { t: "Thu · 4:00 PM" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">Neha offers 3 slots</p>
      <div className="space-y-2">
        {slots.map((s) => (
          <div
            key={s.t}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] font-medium ${
              s.chosen ? "bg-success-muted text-success ring-1 ring-success/30" : "bg-white/[0.04] text-dark-text-secondary"
            }`}
          >
            {s.t}
            {s.chosen && <Check className="h-3.5 w-3.5" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-dark-text-muted">
        <CalendarCheck className="h-3.5 w-3.5 text-success" />
        Booked on Google Calendar · invite sent
      </div>
    </div>
  );
}

function RoundsVisual() {
  const rounds = [
    { n: 1, label: "Technical", state: "done" },
    { n: 2, label: "Manager", state: "live" },
    { n: 3, label: "HR", state: "todo" },
  ] as const;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="flex items-center">
        {rounds.map((r, i) => (
          <div key={r.n} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                  r.state === "done"
                    ? "bg-success text-black"
                    : r.state === "live"
                      ? "bg-accent text-white ring-4 ring-accent/25"
                      : "border border-dashed border-white/20 text-dark-text-muted"
                }`}
              >
                {r.state === "done" ? <Check className="h-4 w-4" /> : r.n}
              </span>
              <span className="text-[9.5px] text-dark-text-muted">{r.label}</span>
            </div>
            {i < rounds.length - 1 && (
              <span className={`mx-1.5 mb-4 h-px flex-1 ${r.state === "done" ? "bg-success/60" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[10.5px] text-dark-text-secondary">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">feedback link · no login needed</span>
      </div>
    </div>
  );
}

function RemindersVisual() {
  const items = [
    { icon: Bell, title: "Reminder call", meta: "Interview tomorrow · 11:00", tone: "text-info bg-info-muted", state: "Answered" },
    { icon: PhoneCall, title: "Result call", meta: "Moving to round 2", tone: "text-success bg-success-muted", state: "Delivered" },
  ];
  return (
    <div className="space-y-2">
      {items.map(({ icon: Icon, title, meta, tone, state }, i) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0c0c12] px-3.5 py-3"
          style={{ marginLeft: i * 14 }}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-dark-text">{title}</p>
            <p className="truncate text-[10.5px] text-dark-text-muted">{meta}</p>
          </div>
          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-success">{state}</span>
        </div>
      ))}
    </div>
  );
}

function PreJoiningVisual() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="mb-1.5 flex justify-between text-[10.5px] text-dark-text-muted">
        <span>Notice period</span>
        <span className="text-dark-text-secondary">Day 42 of 60</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.07]">
        <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-accent to-purple-300" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2.5 rounded-lg bg-success-muted px-3 py-2">
          <Avatar name="Meera Nair" tone={2} className="h-6 w-6 text-[9px]" />
          <span className="flex-1 text-[11.5px] font-medium text-dark-text">Meera</span>
          <span className="text-[10px] font-semibold text-success">Confirmed</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-warning-muted px-3 py-2">
          <Avatar name="Karan Shah" tone={3} className="h-6 w-6 text-[9px]" />
          <span className="flex-1 text-[11.5px] font-medium text-dark-text">Karan</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-warning">
            <AlertTriangle className="h-3 w-3" /> At risk
          </span>
        </div>
      </div>
    </div>
  );
}

function HelpdeskVisual() {
  const buckets = [
    ["Payroll", 3, "bg-info"],
    ["IT", 2, "bg-accent"],
    ["Attendance", 4, "bg-warning"],
    ["HR docs", 1, "bg-success"],
  ] as const;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="flex flex-wrap gap-2">
        {buckets.map(([name, n, dot]) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-medium text-dark-text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {name}
            <span className="text-dark-text-muted">{n}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-white/[0.04] p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold text-dark-text">Salary slip shows wrong HRA</p>
          <span className="rounded-full bg-warning-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning">Escalated</span>
        </div>
        <p className="mt-1 text-[10.5px] text-dark-text-muted">Routed to Payroll team · logged as ticket</p>
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  const funnel = [
    ["Applied", 100],
    ["Screened", 72],
    ["Shortlisted", 38],
    ["Interviewed", 24],
    ["Joined", 11],
  ] as const;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12] p-4">
      <div className="space-y-2">
        {funnel.map(([k, v], i) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-[74px] shrink-0 text-[10.5px] text-dark-text-muted">{k}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
              <div
                className="h-full rounded-md bg-gradient-to-r from-accent to-purple-300"
                style={{ width: `${v}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-dark-text-muted">Sample funnel for illustration</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <BentoCard
        icon={PhoneCall}
        title="AI screening calls"
        body="Neha phones every applicant, asks the right questions for the role, and captures location, notice period, CTC and more in natural conversation."
        span="md:col-span-6 lg:col-span-4"
        side
      >
        <ScreeningVisual />
      </BentoCard>

      <BentoCard
        icon={Target}
        title="Transparent scoring"
        body="Every candidate gets a score with a factor-by-factor breakdown, so you see exactly why someone was shortlisted."
        span="md:col-span-6 lg:col-span-2"
      >
        <ScoringVisual />
      </BentoCard>

      <BentoCard
        icon={CalendarCheck}
        title="Automatic scheduling"
        body="Neha finds open slots on your interviewers' calendars, offers them on the call, and books the winner."
        span="md:col-span-3 lg:col-span-2"
      >
        <SchedulingVisual />
      </BentoCard>

      <BentoCard
        icon={ClipboardCheck}
        title="Multi-round interviews"
        body="Run one round or five. Interviewers give feedback from a simple link and the pipeline updates itself."
        span="md:col-span-3 lg:col-span-2"
      >
        <RoundsVisual />
      </BentoCard>

      <BentoCard
        icon={Bell}
        title="Reminders and results"
        body="A reminder call before the interview and a clear, kind result call afterwards. Nobody is left waiting."
        span="md:col-span-6 lg:col-span-2"
      >
        <RemindersVisual />
      </BentoCard>

      <BentoCard
        icon={UserCheck}
        title="Pre-joining engagement"
        body="Keep accepted candidates warm through their notice period and flag anyone at risk of dropping off."
        span="md:col-span-3 lg:col-span-2"
      >
        <PreJoiningVisual />
      </BentoCard>

      <BentoCard
        icon={LifeBuoy}
        title="Employee helpdesk"
        body="Payroll, attendance, IT and HR-document questions go to the right team, each one logged as a ticket."
        span="md:col-span-3 lg:col-span-2"
      >
        <HelpdeskVisual />
      </BentoCard>

      <BentoCard
        icon={BarChart3}
        title="Pipeline analytics"
        body="Track conversion by stage, call outcomes and interview results, and see exactly where your funnel leaks."
        span="md:col-span-6 lg:col-span-2"
      >
        <AnalyticsVisual />
      </BentoCard>
    </div>
  );
}
