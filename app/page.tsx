import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

export default async function HomePage() {
  // If logged in, go straight to dashboard (standard internal-tool behavior)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  // Not logged in — minimal sign-in screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090d] px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-dark-text">Neha</p>
            <p className="text-[11px] text-dark-text-muted">SalesCode HR</p>
          </div>
        </div>

        {/* Welcome */}
        <h1 className="text-[22px] font-bold text-dark-text">Welcome back</h1>
        <p className="mt-1 text-[13px] text-dark-text-muted">
          Sign in to manage your candidate pipeline
        </p>

        {/* CTA */}
        <div className="mt-8 space-y-2.5">
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-5 py-3 text-[13px] font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 transition-all hover:shadow-[#8b5cf6]/30"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3 text-[13px] font-medium text-dark-text-secondary transition-all hover:bg-white/[0.05] hover:text-dark-text"
          >
            Create account
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-12 text-center text-[11px] text-dark-text-muted/60">
          Internal tool · Access restricted to authorized SalesCode employees
        </p>
      </div>
    </div>
  );
}
