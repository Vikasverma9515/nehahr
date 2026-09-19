import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Headphones,
  Mail,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase/server";
import { Logo } from "@/app/components/logo";
import { FeatureBento } from "@/app/components/feature-bento";
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
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-x-6 -top-10 bottom-0 -z-10 rounded-[40px] bg-accent/10 blur-3xl" />
      <div className="card-glass overflow-hidden rounded-2xl">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-dark-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 text-[11px] text-dark-text-muted">Candidate · Priya Patel · Senior Software Engineer</span>
        </div>

        <div className="grid gap-px bg-dark-border md:grid-cols-5">
          {/* Call transcript */}
          <div className="bg-dark-card p-5 md:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-dark-text">
                <Headphones className="h-4 w-4 text-accent" />
                Screening call
              </div>
              <span className="rounded-full bg-success-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                Completed · 4:12
              </span>
            </div>
            <div className="space-y-3 text-[12.5px] leading-relaxed">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-bold text-accent">N</span>
                <p className="rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-2.5 text-dark-text-secondary">
                  Hi Priya, this is Neha calling from the recruiting team. Do you have a few minutes to talk about the Senior Software Engineer role?
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-dark-text-muted">P</span>
                <p className="rounded-2xl rounded-tl-sm bg-white/[0.02] px-3.5 py-2.5 text-dark-text-secondary">
                  Yes, absolutely. I&apos;m currently serving a 60-day notice period, and I&apos;m open to a hybrid setup.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-bold text-accent">N</span>
                <p className="rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-2.5 text-dark-text-secondary">
                  Great. And what compensation range are you expecting for this move?
                </p>
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-dark-card p-5 md:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold text-dark-text">
              <Sparkles className="h-4 w-4 text-accent" />
              AI assessment
            </div>
            <div className="mb-5 flex items-end gap-3">
              <span className="font-display text-5xl text-dark-text">92</span>
              <span className="mb-1.5 rounded-full bg-success-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                Qualified
              </span>
            </div>
            {[
              ["Location fit", 95],
              ["Work model", 100],
              ["Notice period", 90],
              ["CTC alignment", 90],
              ["Role experience", 95],
            ].map(([label, value]) => (
              <div key={label} className="mb-2.5">
                <div className="mb-1 flex justify-between text-[11px] text-dark-text-muted">
                  <span>{label}</span>
                  <span className="text-dark-text-secondary">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
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
    <div className="min-h-screen bg-dark-bg text-dark-text">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px] overflow-hidden">
        <div className="absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
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
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center md:pt-24">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-dark-border bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-dark-text-secondary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            The AI recruiter that picks up the phone
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-dark-text md:text-6xl">
            Hire faster, without{" "}
            <span className="bg-gradient-to-r from-accent to-purple-300 bg-clip-text text-transparent">chasing candidates</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-dark-text-secondary md:text-[17px]">
            Neha is an AI HR agent that calls applicants, screens them against your role, books interviews, collects
            feedback and keeps every candidate informed, for teams of any size and in any industry.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-dark-text-muted">
            {["No app for candidates to install", "Works over normal phone calls", "You stay in control of every decision"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5 text-success" />
                {t}
              </li>
            ))}
          </ul>

          <div className="relative mt-16">
            <ProductPreview />
            <div className="pointer-events-none absolute -bottom-10 -right-8 hidden rotate-[4deg] xl:block">
              <PhoneMock />
            </div>
          </div>
        </section>

        {/* Problem → solution */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">The problem</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Hiring shouldn&apos;t run on phone tag</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-dark-text-secondary">
              Missed calls, endless email threads and half-filled spreadsheets slow down every hire. Here is what changes when Neha takes over the legwork.
            </p>
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
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Everything between &ldquo;applied&rdquo; and &ldquo;joined&rdquo;</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-dark-text-secondary">
              Replace the scattered calls, spreadsheets and follow-up emails with one system that does the legwork.
            </p>
          </div>
          <div className="mt-14">
            <FeatureBento />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-dark-border bg-dark-secondary/60">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">From job post to offer in four steps</h2>
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
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-dark-border bg-gradient-to-b from-white/[0.03] to-transparent p-6">
                <Icon className="mb-4 h-6 w-6 text-accent" />
                <h3 className="text-[16px] font-semibold text-dark-text">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-dark-text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Questions, answered</h2>
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
