"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Phone } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-purple-700">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-[22px] font-bold text-dark-text">Welcome back</h1>
          <p className="mt-1 text-[13px] text-dark-text-muted">Sign in to Neha HR</p>
        </div>

        <div className="card-glass rounded-2xl p-6">
          <form action={action} className="space-y-5">
            {state?.error && (
              <div className="rounded-xl bg-danger-muted px-4 py-3 text-[13px] font-medium text-danger">{state.error}</div>
            )}
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold uppercase tracking-wider text-dark-text-muted">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@salescode.ai"
                className="mt-2 block w-full rounded-xl px-4 py-3 text-[13px]" />
            </div>
            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-wider text-dark-text-muted">Password</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••"
                className="mt-2 block w-full rounded-xl px-4 py-3 text-[13px]" />
            </div>
            <button type="submit" disabled={pending}
              className="btn-primary w-full rounded-xl px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] text-dark-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
