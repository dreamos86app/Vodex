import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOriginMode, resolveAppOrigin } from "@/lib/url/app-origin";
import { getSupabasePublicUrl } from "@/lib/supabase/auth-domain";

export const dynamic = "force-dynamic";

function supabaseHost(): string | null {
  const url = getSupabasePublicUrl();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function authCookieNames(all: { name: string }[]): string[] {
  return all
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-") || n.includes("supabase") || n.includes("auth-token"));
}

/** Dev-only auth/session diagnostic — no secret values. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const requestUrl = req.url;
  const origin = resolveAppOrigin(requestUrl);
  const mode = getOriginMode(requestUrl);
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const names = authCookieNames(allCookies);

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const host = new URL(requestUrl).hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || origin.includes("localhost");

  return NextResponse.json({
    ok: Boolean(user),
    origin,
    originMode: mode,
    requestHost: host,
    isLocalhost: isLocal,
    supabaseHost: supabaseHost(),
    authCookieNames: names,
    authCookieCount: names.length,
    userResolved: Boolean(user),
    userId: user?.id ?? null,
    sessionError: error?.message ?? null,
    hint: user
      ? "Session resolved on server."
      : names.length === 0
        ? "No Supabase auth cookies — sign in on this same origin (localhost:3000 in dev)."
        : "Auth cookies present but user not resolved — try refresh or sign in again.",
  });
}
