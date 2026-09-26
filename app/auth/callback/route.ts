import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

// Supabase sends users back here after Google / Microsoft sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=sso", url.origin));
}
