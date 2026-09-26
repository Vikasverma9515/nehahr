"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, Briefcase, Calendar, Phone,
  AudioLines, BarChart3, Settings, HelpCircle, ArrowRight, User,
  X, Loader2,
} from "lucide-react";
import { PersonAvatar } from "@/app/components/person-avatar";

type Hit = {
  id: string;
  type: "candidate" | "job" | "nav";
  label: string;
  sub?: string;
  href: string;
  badge?: string;
};

const NAV: Hit[] = [
  { id: "nav-dash", type: "nav", label: "Dashboard", sub: "Overview", href: "/dashboard", badge: "⌘1" },
  { id: "nav-candidates", type: "nav", label: "Candidates", sub: "All candidates", href: "/dashboard/candidates", badge: "⌘2" },
  { id: "nav-jobs", type: "nav", label: "Jobs", sub: "Open positions", href: "/dashboard/jobs", badge: "⌘3" },
  { id: "nav-interviews", type: "nav", label: "Interviews", sub: "Scheduled interviews", href: "/dashboard/interviews" },
  { id: "nav-calls", type: "nav", label: "Calls", sub: "Call history", href: "/dashboard/calls" },
  { id: "nav-ai-interviews", type: "nav", label: "AI Interviews", sub: "Video interviews by Neha", href: "/dashboard/ai-interviews" },
  { id: "nav-playground", type: "nav", label: "Playground", sub: "Talk to Neha", href: "/dashboard/playground" },
  { id: "nav-analytics", type: "nav", label: "Analytics", sub: "Hiring insights", href: "/dashboard/analytics" },
  { id: "nav-helpdesk", type: "nav", label: "Helpdesk", sub: "Candidate requests", href: "/dashboard/helpdesk" },
  { id: "nav-settings", type: "nav", label: "Settings", sub: "System settings", href: "/dashboard/settings" },
  { id: "nav-import", type: "nav", label: "Import Candidates", sub: "CSV or resumes", href: "/dashboard/candidates/import" },
  { id: "nav-new-candidate", type: "nav", label: "Add Candidate", sub: "Create manually", href: "/dashboard/candidates/new" },
  { id: "nav-new-job", type: "nav", label: "Create Job", sub: "New position", href: "/dashboard/jobs/new" },
];

const NAV_ICON: Record<string, React.FC<{ className?: string }>> = {
  "nav-dash": LayoutDashboard,
  "nav-candidates": Users,
  "nav-jobs": Briefcase,
  "nav-interviews": Calendar,
  "nav-calls": Phone,
  "nav-playground": AudioLines,
  "nav-analytics": BarChart3,
  "nav-settings": Settings,
  "nav-helpdesk": HelpCircle,
  "nav-import": Users,
  "nav-new-candidate": User,
  "nav-new-job": Briefcase,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Open with Cmd+K
  useEffect(() => {
    const shortcuts: Record<string, string> = {
      "1": "/dashboard",
      "2": "/dashboard/candidates",
      "3": "/dashboard/jobs",
    };
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") { setOpen(false); return; }
      // ⌘1/⌘2/⌘3 quick-nav (only when not typing in an input)
      if ((e.metaKey || e.ctrlKey) && shortcuts[e.key]) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
          e.preventDefault();
          window.location.href = shortcuts[e.key];
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(NAV);
      setCursor(0);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults(NAV); setCursor(0); return; }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/command-search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error();
        const data = await res.json() as { candidates: Hit[]; jobs: Hit[] };
        const navHits = NAV.filter((n) =>
          n.label.toLowerCase().includes(q.toLowerCase()) ||
          (n.sub || "").toLowerCase().includes(q.toLowerCase())
        );
        setResults([...data.candidates, ...data.jobs, ...navHits]);
      } catch {
        const navHits = NAV.filter((n) =>
          n.label.toLowerCase().includes(q.toLowerCase()) ||
          (n.sub || "").toLowerCase().includes(q.toLowerCase())
        );
        setResults(navHits);
      }
      setCursor(0);
    });
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  function go(hit: Hit) {
    router.push(hit.href);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      go(results[cursor]);
    }
  }

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[560px] mx-4 rounded-2xl border border-white/[0.10] bg-[#111116] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-dark-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search candidates, jobs, or navigate…"
            className="flex-1 bg-transparent text-[14px] text-dark-text placeholder-dark-text-muted/60 outline-none"
          />
          {isPending
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-dark-text-muted" />
            : query && <button onClick={() => setQuery("")}><X className="h-3.5 w-3.5 text-dark-text-muted hover:text-dark-text" /></button>
          }
          <kbd className="hidden rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-dark-text-muted sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {results.length === 0 && (
            <p className="py-8 text-center text-[13px] text-dark-text-muted">No results for &ldquo;{query}&rdquo;</p>
          )}
          {results.map((hit, i) => {
            const Icon = hit.type === "nav" ? (NAV_ICON[hit.id] || ArrowRight) : null;
            return (
              <button
                key={hit.id}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === cursor ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                }`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit)}
              >
                {hit.type === "candidate" ? (
                  <PersonAvatar name={hit.label} size={28} />
                ) : hit.type === "job" ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#8b5cf6]/15">
                    <Briefcase className="h-3.5 w-3.5 text-accent" />
                  </div>
                ) : Icon ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                    <Icon className="h-3.5 w-3.5 text-dark-text-muted" />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-dark-text">{hit.label}</p>
                  {hit.sub && <p className="text-[11px] text-dark-text-muted">{hit.sub}</p>}
                </div>

                {hit.badge && (
                  <kbd className="shrink-0 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-dark-text-muted">
                    {hit.badge}
                  </kbd>
                )}
                {hit.type !== "nav" && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    hit.type === "candidate" ? "bg-accent/10 text-accent" : "bg-[#7dd4a8]/10 text-[#7dd4a8]"
                  }`}>
                    {hit.type}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-dark-text-muted">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">ESC</kbd> close</span>
          </div>
          <span className="text-[10px] text-dark-text-muted">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

// Trigger button for the sidebar
export function CommandTrigger() {
  return (
    <button
      onClick={() => {
        const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
        window.dispatchEvent(e);
      }}
      className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12px] text-dark-text-muted hover:border-white/[0.12] hover:text-dark-text-secondary transition-all"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
    </button>
  );
}
