import { createHmac } from "node:crypto";
import { createClient, AUTH_DISABLED } from "@/app/lib/supabase/server";

// Server-side helpers for calling the FastAPI backend.

// Server-to-backend calls go over loopback / the private URL.
export const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.BACKEND_URL || "http://localhost:8000";

// The browser follows these links itself (audio, OAuth), so they must be public.
export const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/** fetch() against the FastAPI backend, carrying the signed-in user's session. */
export async function backendFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!AUTH_DISABLED) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }
  // JSON by default; FormData sets its own multipart boundary.
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BACKEND_URL}${path}`, { cache: "no-store", ...init, headers });
}

/**
 * A backend URL the browser can open without a session header.
 * The backend checks the signature with the same APP_SECRET.
 */
export function signedBackendUrl(path: string, ttlSeconds = 3600, query: Record<string, string> = {}) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const secret = process.env.APP_SECRET || "";
  const sig = createHmac("sha256", secret).update(`${path}:${exp}`).digest("hex");
  const params = new URLSearchParams({ ...query, exp: String(exp), sig });
  return `${PUBLIC_BACKEND_URL}${path}?${params}`;
}
