import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  CircleCheck,
  LayoutDashboard,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase/server";
import { Logo } from "@/app/components/logo";
import { FeatureBento } from "@/app/components/feature-bento";
import GradientWaves from "@/app/components/GradientWaves";
import { Peep, PeepStack } from "@/app/components/peep";
import { Illus, type IllusName } from "@/app/components/illus";
import {
  PhoneMock,
  ProblemBoard,
  SolutionBoard,
  StepCall,
  StepPost,
  StepSchedule,
  StepScore,
} from "@/app/components/landing-visuals";

// The landing page must always render, even if the auth backend is slow or down.
async function getUserSafely() {
  try {
    const supabase = await createClient();
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    return result?.data?.user ?? null;
  } catch {
    return null;
  }
}

const steps = [
  {
    n: "01",
    title: "Post a role",
    body: "Add the job, required skills, work model and salary range. Add candidates one by one or in bulk.",
    visual: <StepPost />,
  },
  {
    n: "02",
    title: "Neha screens",
    body: "She calls each candidate, has a real conversation, and scores the fit against your role.",
    visual: <StepCall />,
  },
  {
    n: "03",
    title: "You shortlist",
    body: "Review transcripts, summaries and scores in one place, then shortlist with a single click.",
    visual: <StepScore />,
  },
  {
    n: "04",
    title: "Schedule to offer",
    body: "Neha books interviews, collects feedback, delivers results, and keeps candidates engaged until they join.",
    visual: <StepSchedule />,
  },
];

const AUDIENCE_ILLUS: IllusName[] = ["bust-46", "bust-10", "bust-102"];

const stages = ["New", "Screening", "Screened", "Shortlisted", "Scheduled", "Interviewing", "Offer", "Joined"];

const faqs = [
  {
    q: "Does Neha work for any company?",
    a: "Yes. Neha is not tied to one industry or team. You define the roles, the screening criteria and the interview process, and she adapts to them.",
  },
  {
    q: "How does Neha introduce herself on a call?",
    a: "By name, on behalf of your recruiting team. If your region or policy requires an explicit AI disclosure, add it to the greeting in the call prompts. Candidates get a fast, consistent and courteous experience either way.",
  },
  {
    q: "Can I review what was said on a call?",
    a: "Every call is stored with a full transcript, an AI summary, the data Neha extracted, and a recording, all attached to the candidate's profile.",
  },
  {
    q: "Which tools does it connect to?",
    a: "Google Calendar for scheduling and Gmail for booking confirmations. Calls run over standard phone numbers, so candidates need nothing installed.",
  },
  {
    q: "Who makes the final hiring decision?",
    a: "You do. Neha handles the repetitive coordination and gives you the information to decide. She never rejects or hires on her own without your workflow.",
  },
];

function ProductPreview() {
  const nav = [
    [LayoutDashboard, "Dashboard", true],
    [Users, "Candidates", false],
    [Briefcase, "Jobs", false],
    [Calendar, "Interviews", false],
    [Phone, "Calls", false],
    [BarChart3, "Analytics", false],
  ] as const;
  const kpis = [
    { label: "Candidates", value: "1,284", delta: "+12%", icon: Users },
    { label: "Calls today", value: "86", delta: "+24%", icon: Phone },
    { label: "Interviews booked", value: "32", delta: "+9%", icon: Calendar },
    { label: "Avg. fit score", value: "84", delta: "+6%", icon: TrendingUp },
  ];
  const funnel = [
    ["New", 100],
    ["Screened", 78],
    ["Shortlisted", 46],
    ["Interview", 28],
    ["Offer", 12],
  ] as const;
  const rows = [
    { name: "Priya Patel", face: "priya", role: "Senior Software Engineer", score: 92, status: "Qualified", tone: "text-success bg-success-muted" },
    { name: "Rahul Sharma", face: "rahul", role: "Product Designer", score: 88, status: "Interview", tone: "text-accent bg-accent-muted" },
    { name: "Sneha Reddy", face: "sneha", role: "Data Analyst", score: 81, status: "Screening", tone: "text-info bg-info-muted" },
    { name: "Amit Kumar", face: "amit", role: "Sales Lead", score: 74, status: "Scheduled", tone: "text-warning bg-warning-muted" },
  ] as const;
  const bars = [38, 52, 44, 68, 60, 82, 74, 96, 88, 70, 92, 100];

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-x-6 -top-6 bottom-0 rounded-[32px] bg-accent/20 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-dark-card shadow-[0_30px_120px_-20px_rgba(139,92,246,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/60 to-transparent" />
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-dark-border bg-white/[0.02] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-0.5 text-[10.5px] text-dark-text-muted">
            <Search className="h-3 w-3" /> app.neha.ai/dashboard
          </span>
          <span className="w-12" />
        </div>

        <div className="flex text-left">
          {/* sidebar */}
          <aside className="hidden w-44 shrink-0 border-r border-dark-border bg-dark-secondary p-3 md:block">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-400 text-[11px] font-bold text-white">N</span>
              <span className="text-[12px] font-semibold text-dark-text">Neha</span>
            </div>
            <ul className="space-y-0.5">
              {nav.map(([Icon, label, active]) => (
                <li
                  key={label}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium ${
                    active ? "bg-accent-muted text-accent" : "text-dark-text-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-dark-border bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-dark-text">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Neha is live
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-dark-text-muted">3 calls in progress, 14 queued</p>
            </div>
          </aside>

          {/* main */}
          <div className="min-w-0 flex-1 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold text-dark-text">Good morning, Anika</p>
                <p className="text-[11.5px] text-dark-text-muted">Here is what Neha handled overnight</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white sm:flex">
                <Plus className="h-3 w-3" /> New role
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map(({ label, value, delta, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-dark-border bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dark-text-muted">{label}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-muted text-accent">
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-2xl text-dark-text">{value}</span>
                    <span className="text-[10.5px] font-semibold text-success">{delta}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-5">
              {/* chart */}
              <div className="rounded-xl border border-dark-border bg-white/[0.03] p-4 lg:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-dark-text">Screening calls</span>
                  <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] text-dark-text-muted">Last 12 weeks</span>
                </div>
                <div className="flex h-28 items-end gap-2">
                  {bars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-accent/30 to-accent" style={{ height: `${h}%`, opacity: 0.55 + h / 250 }} />
                  ))}
                </div>
              </div>
              {/* funnel */}
              <div className="rounded-xl border border-dark-border bg-white/[0.03] p-4 lg:col-span-2">
                <span className="mb-3 block text-[12px] font-semibold text-dark-text">Hiring pipeline</span>
                <div className="space-y-2">
                  {funnel.map(([label, w]) => (
                    <div key={label} className="flex items-center gap-2 text-[10.5px]">
                      <span className="w-16 text-dark-text-muted">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-300" style={{ width: `${w}%` }} />
                      </div>
                      <span className="w-6 text-right text-dark-text-secondary">{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* candidates */}
            <div className="mt-3 rounded-xl border border-dark-border bg-white/[0.03]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-dark-text">Top candidates</span>
                <span className="text-[11px] text-accent">View all</span>
              </div>
              {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-3 border-t border-dark-border px-4 py-2.5">
                  <Peep name={r.face} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-dark-text">{r.name}</p>
                    <p className="truncate text-[10.5px] text-dark-text-muted">{r.role}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${r.tone}`}>{r.status}</span>
                  <span className="w-8 text-right font-display text-[15px] text-dark-text">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const user = await getUserSafely();
  const loggedIn = Boolean(user);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-dark-bg text-dark-text">
      {/* Animated wave field behind the hero. It renders at reduced resolution and 30fps, and
          fades into the page background with plain gradients (cheaper than masks or blurs). */}
      <div className="pointer-events-none absolute inset-x-0 top-[20px] z-0 h-[900px] overflow-hidden" aria-hidden="true">
        <GradientWaves
          horizonColor="#3b1f8c"
          waveColor="#8b5cf6"
          crestColor="#c4b5fd"
          speed={0.35}
          amplitude={2.4}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1.0}
          height={5.5}
          fogDepth={34}
          detail="medium"
          brightness={1.1}
          opacity={1.0}
          mouseInteraction={false}
          parallaxStrength={0.5}
          grain={true}
          grainIntensity={0.05}
          maxDpr={0.75}
          maxFps={30}
        />
        <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-dark-bg to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[420px] bg-gradient-to-t from-dark-bg to-transparent" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Neha home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-dark-text-secondary md:flex">
          <a href="#features" className="hover:text-dark-text">Features</a>
          <a href="#how-it-works" className="hover:text-dark-text">How it works</a>
          <a href="#faq" className="hover:text-dark-text">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link href="/dashboard" className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white">
              Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-4 py-2 text-[13px] font-medium text-dark-text-secondary hover:text-dark-text">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary rounded-xl px-4 py-2 text-[13px] font-semibold text-white">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-2 text-center md:pt-4">
          <div className="mb-3 flex justify-center">
            <PeepStack names={["priya", "rahul", "zoe", "amit", "maya", "asha"]} size={36} ring="ring-dark-bg" />
          </div>
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-dark-border bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-dark-text-secondary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            The AI recruiter that picks up the phone
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-dark-text md:text-5xl">
            Hire faster, without{" "}
            <span className="bg-gradient-to-r from-accent to-purple-300 bg-clip-text text-transparent">chasing candidates</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-dark-text-secondary md:text-[17px]">
            Neha is an AI HR agent that calls applicants, screens them against your role, books interviews, collects
            feedback and keeps every candidate informed, for teams of any size and in any industry.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={loggedIn ? "/dashboard" : "/signup"}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[14px] font-semibold text-white"
            >
              {loggedIn ? "Go to dashboard" : "Start for free"} <ArrowRight className="h-4 w-4" />
            </Link>
            {!loggedIn && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-dark-border-light bg-white/[0.02] px-6 py-3.5 text-[14px] font-medium text-dark-text-secondary transition hover:bg-white/[0.05] hover:text-dark-text"
              >
                Sign in
              </Link>
            )}
          </div>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-dark-text-secondary">
            {["No app for candidates to install", "Works over normal phone calls", "You stay in control of every decision"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5 text-success" />
                {t}
              </li>
            ))}
          </ul>

          <div className="relative mt-8">
            <ProductPreview />
            <div className="pointer-events-none absolute -bottom-10 -right-8 hidden rotate-[4deg] xl:block">
              <PhoneMock />
            </div>
          </div>
        </section>

        {/* Problem → solution */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">The problem</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Hiring shouldn&apos;t run on phone tag</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-dark-text-secondary">
              Missed calls, endless email threads and half-filled spreadsheets slow down every hire. Here is what changes when Neha takes over the legwork.
            </p>
          </div>
          </div>
          <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <ProblemBoard />
            <div className="flex items-center justify-center">
              <span className="flex h-12 w-12 rotate-90 items-center justify-center rounded-full border border-dark-border-light bg-dark-card text-accent lg:rotate-0">
                <ArrowRight className="h-5 w-5" />
              </span>
            </div>
            <SolutionBoard />
          </div>
        </section>

        {/* Pipeline */}
        <section className="mx-auto max-w-6xl px-6 py-10">
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-text-muted">
            One pipeline from application to day one
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {stages.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className="rounded-full border border-dark-border bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-dark-text-secondary">
                  {s}
                </span>
                {i < stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-dark-text-muted/60" />}
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
          <div className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Everything between &ldquo;applied&rdquo; and &ldquo;joined&rdquo;</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-dark-text-secondary">
              Replace the scattered calls, spreadsheets and follow-up emails with one system that does the legwork.
            </p>
          </div>
          </div>
          <div className="mt-14">
            <FeatureBento />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-dark-border bg-dark-secondary/60">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="relative">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">How it works</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">From job post to offer in four steps</h2>
              </div>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n} className="relative flex flex-col">
                  <div className="mb-5">{s.visual}</div>
                  <span className="font-display text-4xl text-accent/40">{s.n}</span>
                  <h3 className="mt-2 text-[16px] font-semibold text-dark-text">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-dark-text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audience */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Growing startups",
                body: "Hire without a dedicated recruiter. Neha covers screening and coordination while founders focus on the product.",
              },
              {
                icon: Mail,
                title: "Staffing and agencies",
                body: "Handle high candidate volume across many open roles without growing headcount for every new client.",
              },
              {
                icon: UserCheck,
                title: "In-house HR teams",
                body: "Free your team from repetitive calls and scheduling so they can spend time on the conversations that matter.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="overflow-hidden rounded-2xl border border-dark-border bg-gradient-to-b from-white/[0.03] to-transparent">
                <div className="relative flex h-[160px] items-end justify-center bg-gradient-to-b from-accent/[0.16] to-transparent">
                  <Illus name={AUDIENCE_ILLUS[i]} height={148} glow={false} />
                </div>
                <div className="p-6 pt-5">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5 text-accent" />
                    <h3 className="text-[16px] font-semibold text-dark-text">{title}</h3>
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-dark-text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
          <div className="relative">
            <div className="text-center">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">FAQ</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Questions, answered</h2>
            </div>
          </div>
          <div className="mt-10 divide-y divide-dark-border rounded-2xl border border-dark-border bg-dark-card/60">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-semibold text-dark-text">
                  {q}
                  <span className="text-xl leading-none text-dark-text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[13.5px] leading-relaxed text-dark-text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-dark-border-light bg-gradient-to-br from-accent/20 via-dark-card to-dark-card px-8 py-16 text-center">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <Illus name="standing-4" height={260} className="absolute bottom-0 left-8 hidden lg:block" />
            <Illus name="standing-24" height={250} flip className="absolute bottom-0 right-8 hidden lg:block" />
            <div className="relative mb-6 flex justify-center">
              <PeepStack names={["maya", "rahul", "zoe", "amit", "asha", "finn", "sneha"]} size={48} ring="ring-dark-card" />
            </div>
            <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">Give your hiring a head start</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-dark-text-secondary">
              Create an account, add your first role, and let Neha make the first call.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={loggedIn ? "/dashboard" : "/signup"}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[14px] font-semibold text-white"
              >
                {loggedIn ? "Open your dashboard" : "Create your account"} <ArrowRight className="h-4 w-4" />
              </Link>
              {!loggedIn && (
                <Link href="/login" className="rounded-xl px-6 py-3.5 text-[14px] font-medium text-dark-text-secondary hover:text-dark-text">
                  I already have an account
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-dark-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[12px] text-dark-text-muted md:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Neha HR. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#features" className="hover:text-dark-text">Features</a>
            <a href="#faq" className="hover:text-dark-text">FAQ</a>
            <Link href={loggedIn ? "/dashboard" : "/login"} className="hover:text-dark-text">{loggedIn ? "Dashboard" : "Sign in"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
