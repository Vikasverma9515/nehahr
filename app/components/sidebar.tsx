"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Phone,
  HelpCircle,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { LogoMark } from "@/app/components/logo";

// Grouped nav — like Linear/Lever: "Work" section + "Admin" section
const workItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/candidates", label: "Candidates", icon: Users },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/interviews", label: "Interviews", icon: Calendar },
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
];

const adminItems = [
  { href: "/dashboard/helpdesk", label: "Helpdesk", icon: HelpCircle },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userName, userEmail }: { userName: string; userEmail?: string }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="flex w-[240px] flex-col border-r border-white/[0.06] bg-[#0a0a0f]">
      {/* Logo */}
      <Link href="/" title="Back to home page" className="flex h-[64px] items-center gap-2.5 px-5 transition hover:opacity-80">
        <LogoMark className="h-9 w-9" />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold tracking-tight text-white">Neha</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-dark-text-muted">
              HR
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-dark-text-muted">AI Recruiting Agent</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Work section */}
        <div className="mb-4">
          <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted/60">
            Workspace
          </p>
          <div className="space-y-0.5">
            {workItems.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-dark-text-secondary hover:bg-white/[0.03] hover:text-white"
                  )}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon
                    className={clsx(
                      "h-[16px] w-[16px] shrink-0 transition-colors",
                      active ? "text-accent" : "text-dark-text-muted group-hover:text-dark-text-secondary"
                    )}
                  />
                  <span className={clsx("font-medium", active && "font-semibold")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin section */}
        <div>
          <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted/60">
            Admin
          </p>
          <div className="space-y-0.5">
            {adminItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-dark-text-secondary hover:bg-white/[0.03] hover:text-white"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon
                    className={clsx(
                      "h-[16px] w-[16px] shrink-0 transition-colors",
                      active ? "text-accent" : "text-dark-text-muted group-hover:text-dark-text-secondary"
                    )}
                  />
                  <span className={clsx("font-medium", active && "font-semibold")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6]/30 to-[#6d28d9]/30 text-[12px] font-bold text-accent">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">{userName}</p>
            <p className="truncate text-[10px] text-dark-text-muted">
              {userEmail || "Neha HR"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-dark-text-muted transition-all hover:bg-white/[0.05] hover:text-dark-text-secondary"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
