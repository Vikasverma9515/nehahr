"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { LogoMark } from "@/app/components/logo";
import { SsoButtons } from "@/app/components/sso-buttons";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="Neha home" className="mb-4 inline-block">
            <LogoMark className="h-14 w-14" />
          </Link>
          <h1 className="text-[22px] font-bold text-dark-text">Create account</h1>
          <p className="mt-1 text-[13px] text-dark-text-muted">Set up your Neha workspace</p>
        </div>

        <div className="card-glass rounded-2xl p-6">
          <SsoButtons />
          <form action={action} className="space-y-5">
            {state?.error && (
              <div className="rounded-xl bg-danger-muted px-4 py-3 text-[13px] font-medium text-danger">{state.error}</div>
            )}
            <div>
              <label htmlFor="fullName" className="block text-[12px] font-semibold uppercase tracking-wider text-dark-text-muted">Full Name</label>
              <input id="fullName" name="fullName" type="text" required placeholder="Jane Doe"
                className="mt-2 block w-full rounded-xl px-4 py-3 text-[13px]" />
            </div>
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold uppercase tracking-wider text-dark-text-muted">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                className="mt-2 block w-full rounded-xl px-4 py-3 text-[13px]" />
            </div>
            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-wider text-dark-text-muted">Password</label>
              <input id="password" name="password" type="password" required autoComplete="new-password" placeholder="••••••••"
                className="mt-2 block w-full rounded-xl px-4 py-3 text-[13px]" />
            </div>
            <button type="submit" disabled={pending}
              className="btn-primary w-full rounded-xl px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
              {pending ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] text-dark-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
