"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

const NOT_CONFIGURED =
  "Sign-in isn't set up on this deployment yet: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing in the hosting environment variables.";

const isConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function login(prevState: unknown, formData: FormData) {
  if (!isConfigured()) return { error: NOT_CONFIGURED };
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  } catch {
    return { error: "Could not reach the sign-in service. Please try again." };
  }

  redirect("/dashboard");
}

export async function signup(prevState: unknown, formData: FormData) {
  if (!isConfigured()) return { error: NOT_CONFIGURED };
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || !fullName) {
    return { error: "All fields are required" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    // With email confirmation on, there is no session yet.
    if (!data.session) return { error: "Account created. Check your email to confirm it, then sign in." };
  } catch {
    return { error: "Could not reach the sign-in service. Please try again." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
