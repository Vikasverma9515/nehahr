import {
  AlertTriangle,
  CalendarCheck,
  Check,
  Clock,
  Mail,
  Mic,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const AVATAR_TONES = [
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-indigo-700",
];

export function Avatar({ name, tone = 0, className = "h-8 w-8 text-[11px]" }: { name: string; tone?: number; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-dark-card ${AVATAR_TONES[tone % AVATAR_TONES.length]} ${className}`}
    >
      {initials}
    </span>
  );
}

export function Waveform({ bars = 28, className = "" }: { bars?: number; className?: string }) {
  const heights = Array.from({ length: bars }, (_, i) => 18 + Math.abs(Math.sin(i * 0.9) * 62) + ((i * 37) % 17));
  return (
    <div className={`flex h-10 items-center justify-center gap-[3px] ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-accent to-purple-300"
          style={{ height: `${Math.min(h, 100)}%`, opacity: 0.45 + ((i * 13) % 55) / 100 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: phone mockup showing a live AI call                           */
/* ------------------------------------------------------------------ */

export function PhoneMock({ className = "" }: { className?: string }) {
  return (
    <div className={`w-[230px] rounded-[34px] border border-dark-border-light bg-[#0c0c12] p-2.5 shadow-2xl shadow-black/60 ${className}`}>
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-b from-[#1b1230] via-[#0f0d18] to-[#0a0a10] px-4 pb-5 pt-6">
        <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-purple-300/80">Neha · AI recruiter</p>
        <div className="mt-4 flex flex-col items-center">
          <span className="relative">
            <span className="absolute -inset-2 animate-pulse rounded-full bg-accent/20" />
            <Avatar name="Priya Patel" tone={4} className="relative h-16 w-16 text-lg" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-white">Priya Patel</p>
          <p className="text-[11px] text-dark-text-muted">Senior Software Engineer</p>
          <p className="mt-1 font-mono text-[11px] text-success">02:47</p>
        </div>
        <Waveform bars={26} className="mt-3" />
        <div className="mt-2 rounded-xl bg-white/[0.05] px-3 py-2.5 text-[11px] leading-snug text-dark-text-secondary">
          <span className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-accent">
            <Mic className="h-2.5 w-2.5" /> Live transcript
          </span>
          &ldquo;I can join after a 60-day notice and I&apos;m open to hybrid.&rdquo;
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white">
            <Mic className="h-4 w-4" />
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white shadow-lg shadow-danger/30">
            <PhoneOff className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Problem → solution                                                  */
/* ------------------------------------------------------------------ */

export function ProblemBoard() {
  return (
    <div className="relative h-full rounded-3xl border border-danger/20 bg-gradient-to-b from-danger/[0.06] to-transparent p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-danger">
        <AlertTriangle className="h-3 w-3" /> Without Neha
      </span>

      <div className="relative mt-6 space-y-3">
        {/* missed calls */}
        {[
          ["Rahul Sharma", "Missed call · 11:02"],
          ["Amit Kumar", "Missed call · 12:40"],
          ["Sneha Reddy", "Voicemail · 16:15"],
        ].map(([name, meta], i) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-dark-card px-3.5 py-2.5"
            style={{ transform: `rotate(${i % 2 ? 1.2 : -1}deg)` }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-muted text-danger">
              <PhoneMissed className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-dark-text">{name}</p>
              <p className="text-[11px] text-dark-text-muted">{meta}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-danger/80">Call back</span>
          </div>
        ))}

        {/* email ping-pong */}
        <div className="rounded-xl border border-white/[0.06] bg-dark-card px-3.5 py-3" style={{ transform: "rotate(-0.8deg)" }}>
          <div className="flex items-center gap-2 text-[12px] font-medium text-dark-text">
            <Mail className="h-4 w-4 text-warning" />
            Re: Re: Re: Re: Interview time?
          </div>
          <p className="mt-1 text-[11px] text-dark-text-muted">&ldquo;Sorry, Thursday doesn&apos;t work. Any slot next week?&rdquo;</p>
        </div>

        {/* spreadsheet */}
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-dark-card" style={{ transform: "rotate(0.8deg)" }}>
          <div className="grid grid-cols-4 text-[10px] text-dark-text-muted">
            {["Name", "Notice", "CTC", "Status"].map((h) => (
              <span key={h} className="border-b border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 font-semibold uppercase tracking-wider">
                {h}
              </span>
            ))}
            {[
              ["Rahul", "30d", "?", "??"],
              ["Priya", "?", "25L", "called?"],
              ["Amit", "90d", "?", "?"],
            ].map((row, r) =>
              row.map((cell, c) => (
                <span
                  key={`${r}-${c}`}
                  className={`border-b border-white/[0.04] px-2.5 py-1.5 ${cell.includes("?") ? "bg-danger/[0.08] text-danger" : "text-dark-text-secondary"}`}
                >
                  {cell}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-danger-muted px-4 py-3 text-[12.5px] font-medium text-danger">
        <Clock className="h-4 w-4 shrink-0" />
        Days lost to phone tag before a single interview is booked
      </div>
    </div>
  );
}

const boardColumns = [
  {
    title: "Screened",
    tone: "bg-info",
    cards: [
      { name: "Rahul Sharma", score: 87, tone: 1 },
      { name: "Amit Kumar", score: 78, tone: 3 },
    ],
  },
  {
    title: "Shortlisted",
    tone: "bg-accent",
    cards: [{ name: "Priya Patel", score: 92, tone: 4 }],
  },
  {
    title: "Scheduled",
    tone: "bg-success",
    cards: [{ name: "Meera Nair", score: 89, tone: 2, booked: "Tue · 3:00 PM" }],
  },
];

export function SolutionBoard() {
  return (
    <div className="relative h-full rounded-3xl border border-success/25 bg-gradient-to-b from-success/[0.07] to-transparent p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
        <Sparkles className="h-3 w-3" /> With Neha
      </span>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {boardColumns.map((col) => (
          <div key={col.title} className="rounded-xl bg-white/[0.025] p-2">
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${col.tone}`} />
              {col.title}
            </div>
            <div className="space-y-2">
              {col.cards.map((c) => (
                <div key={c.name} className="rounded-lg border border-white/[0.06] bg-dark-card p-2">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={c.name} tone={c.tone} className="h-5 w-5 text-[8px]" />
                    <span className="truncate text-[10.5px] font-medium text-dark-text">{c.name.split(" ")[0]}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-300" style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-[9.5px] font-semibold text-dark-text-secondary">{c.score}</span>
                  </div>
                  {"booked" in c && c.booked && (
                    <p className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-success">
                      <CalendarCheck className="h-2.5 w-2.5" /> {c.booked}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-dark-card p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted text-accent">
            <PhoneCall className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-dark-text">Neha called 14 candidates today</p>
            <p className="text-[11px] text-dark-text-muted">12 screened · 3 shortlisted · 2 interviews booked</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-success-muted px-4 py-3 text-[12.5px] font-medium text-success">
        <Check className="h-4 w-4 shrink-0" />
        Calls, scoring and scheduling handled while you focus on interviews
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* "How it works" step illustrations                                   */
/* ------------------------------------------------------------------ */

export function StepPost() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-dark-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">New role</p>
      <p className="mt-1 text-[13px] font-semibold text-dark-text">Senior Software Engineer</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["React", "Node.js", "TypeScript", "Hybrid"].map((t) => (
          <span key={t} className="rounded-md bg-accent-muted px-2 py-1 text-[10px] font-medium text-accent">
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-dark-text-muted">
          <span>Salary range</span>
          <span className="text-dark-text-secondary">18 – 30 LPA</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07]">
          <div className="ml-[25%] h-full w-[50%] rounded-full bg-gradient-to-r from-accent to-purple-300" />
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-accent px-3 py-2 text-center text-[11px] font-semibold text-white">Publish role</div>
    </div>
  );
}

export function StepCall() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-dark-card p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name="Rahul Sharma" tone={1} className="h-9 w-9 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-dark-text">Rahul Sharma</p>
          <p className="text-[10px] text-success">On a call with Neha</p>
        </div>
        <PhoneCall className="h-4 w-4 text-success" />
      </div>
      <Waveform bars={30} className="my-3" />
      <div className="space-y-1.5 text-[10.5px]">
        <p className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-dark-text-secondary">Which city are you based in?</p>
        <p className="ml-6 rounded-lg bg-accent-muted px-2.5 py-1.5 text-purple-200">Mumbai. Happy with hybrid.</p>
      </div>
    </div>
  );
}

export function StepScore() {
  const rows = [
    ["Priya Patel", 92, 4],
    ["Rahul Sharma", 87, 1],
    ["Amit Kumar", 78, 3],
  ] as const;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-dark-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-text-muted">Ranked by fit</p>
      <div className="mt-3 space-y-3">
        {rows.map(([name, score, tone], i) => (
          <div key={name} className="flex items-center gap-2.5">
            <span className="w-3 text-[10px] font-bold text-dark-text-muted">{i + 1}</span>
            <Avatar name={name} tone={tone} className="h-7 w-7 text-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[11px]">
                <span className="truncate font-medium text-dark-text">{name}</span>
                <span className="font-semibold text-dark-text-secondary">{score}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-300" style={{ width: `${score}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-success-muted px-3 py-2 text-center text-[11px] font-semibold text-success">Shortlist top 2</div>
    </div>
  );
}

export function StepSchedule() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-dark-card p-4">
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((d, i) => (
          <div key={d} className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-dark-text-muted">{d}</p>
            <div className="mt-1.5 space-y-1">
              {[0, 1, 2].map((s) => {
                const chosen = i === 1 && s === 1;
                const busy = (i + s) % 3 === 0;
                return (
                  <span
                    key={s}
                    className={`block h-5 rounded-md ${
                      chosen ? "bg-success ring-2 ring-success/40" : busy ? "bg-white/[0.07]" : "border border-dashed border-white/[0.12]"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-muted px-3 py-2 text-[11px] font-semibold text-success">
        <CalendarCheck className="h-3.5 w-3.5" />
        Booked · Tue 3:00 PM · Invite sent
      </div>
    </div>
  );
}
