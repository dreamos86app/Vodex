import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bootstrapProfileFromOAuth,
  readRefCookieFromRequest,
} from "@/lib/auth/profile-bootstrap";
import { DREAMOS_REF_COOKIE } from "@/lib/auth/ref-cookie";
import {
  OAUTH_EPHEMERAL_COOKIES,
  resolvePostAuthDestination,
} from "@/lib/auth/oauth-prep";
import { callbackErrorSlugFromExchangeMessage } from "@/lib/auth";
import { logAuthEvent } from "@/lib/auth/auth-diagnostics";

/**
 * Supabase PKCE auth callback — handles ALL auth redirect cases.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const nextRaw = searchParams.get("next");

  const providerError = searchParams.get("error");
  const providerErrorDesc = searchParams.get("error_description");

  logAuthEvent(
    "oauth_callback_received",
    {
      hasCode: Boolean(code),
      type: type ?? null,
      providerError: providerError ?? null,
    },
    "info",
    "server",
  );

  if (providerError) {
    logAuthEvent("oauth_callback_failed", { providerError }, "warn", "server");
    const slug = providerError === "access_denied" ? "access_denied" : "server_error";
    const params = new URLSearchParams({ error: slug });
    const safeDesc = providerErrorDesc
      ?.replace(/[^\w\s.,!?@\-–—'"]/g, " ")
      .trim()
      .slice(0, 200);
    if (safeDesc && !/token|secret|code/i.test(safeDesc)) {
      params.set("error_description", safeDesc);
    }
    return NextResponse.redirect(`${origin}/auth/login?${params}`);
  }

  if (!code) {
    logAuthEvent("oauth_callback_failed", { reason: "missing_code" }, "warn", "server");
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const slug = callbackErrorSlugFromExchangeMessage(exchangeError.message);
    logAuthEvent(
      "oauth_callback_failed",
      { slug, reason: exchangeError.message.slice(0, 160) },
      "error",
      "server",
    );
    const params = new URLSearchParams({ error: slug });
    const safe = exchangeError.message
      .replace(/[^\w\s.,!?@\-–—'"]/g, " ")
      .trim()
      .slice(0, 180);
    if (safe && !/token|secret|password/i.test(safe)) {
      params.set("error_description", safe);
    }
    return NextResponse.redirect(`${origin}/auth/login?${params}`);
  }

  logAuthEvent("oauth_session_created", undefined, "info", "server");

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  const refCookie = readRefCookieFromRequest(request);

  let onboardingCompleted = true;
  let profileSetupFailed = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      logAuthEvent("profile_ensure_started", { userId: user.id }, "info", "server");
      const result = await bootstrapProfileFromOAuth(user, refCookie);
      onboardingCompleted = result.onboardingCompleted;
      logAuthEvent(
        "profile_ensure_succeeded",
        { onboardingCompleted },
        "info",
        "server",
      );
    }
  } catch (bootstrapErr) {
    profileSetupFailed = true;
    const msg =
      bootstrapErr instanceof Error ? bootstrapErr.message : String(bootstrapErr);
    logAuthEvent("profile_ensure_failed", { reason: msg.slice(0, 160) }, "error", "server");
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth/callback] profile bootstrap:", msg);
    }
  }

  const safeNext = resolvePostAuthDestination(nextRaw, request.headers.get("cookie"));
  const destination = onboardingCompleted
    ? safeNext
    : `/onboarding?next=${encodeURIComponent(safeNext)}`;

  if (profileSetupFailed) {
    const dest = new URL(destination, origin);
    dest.searchParams.set("error", "profile_setup_failed");
    return NextResponse.redirect(dest.toString());
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  for (const name of OAUTH_EPHEMERAL_COOKIES) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }
  return response;
}
