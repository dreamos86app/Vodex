import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { syncAppUserProfile } from "@/lib/publish/app-user-profile-sync";
import { recordPublishedAnalyticsEvents } from "@/lib/publish/published-analytics-server";
import { recordPublishedAuthError } from "@/lib/publish/published-auth-diagnostics";
import {
  parsePublishedOAuthState,
  type PublishedOAuthState,
  PUBLISHED_OAUTH_COOKIE,
} from "@/lib/publish/central-oauth-state";
import {
  applyPendingAuthCookies,
  createRouteHandlerClient,
  type PendingAuthCookie,
} from "@/lib/supabase/route-handler";
import { applyAuthCookieOptions } from "@/lib/auth/auth-cookie-options";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export function readPublishedOAuthState(request: NextRequest): PublishedOAuthState | null {
  const fromQuery = request.nextUrl.searchParams.get("vodex_state");
  if (fromQuery) {
    const parsed = parsePublishedOAuthState(fromQuery);
    if (parsed) return parsed;
  }
  const cookie = request.cookies.get(PUBLISHED_OAUTH_COOKIE)?.value;
  if (cookie) return parsePublishedOAuthState(cookie);
  return null;
}

export async function handlePublishedOAuthCallback(input: {
  request: NextRequest;
  response: NextResponse;
  pending: PendingAuthCookie[];
  state: PublishedOAuthState;
  code: string;
}): Promise<NextResponse> {
  const { request, state, code } = input;
  const pending = input.pending;

  const exchangeJar = NextResponse.next({ request });
  const supabase = createRouteHandlerClient(request, exchangeJar, pending);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  const loginPath = `/p/${state.slug}/login`;

  if (error || !data.session?.user) {
    const reason = error?.message ?? "exchange_failed";
    await recordPublishedAuthError(state.projectId, reason);
    const adminErr = createServiceRoleClient();
    const { data: pubErr } = adminErr
      ? await adminErr
          .from("published_apps" as never)
          .select("owner_id")
          .eq("id", state.publishedAppId)
          .maybeSingle()
      : { data: null };
    const errOwner = (pubErr as { owner_id?: string } | null)?.owner_id ?? "";
    await recordPublishedAnalyticsEvents({
      slug: state.slug,
      projectId: state.projectId,
      ownerId: errOwner,
      publishedAppId: state.publishedAppId,
      events: [{ event_type: "auth_error", meta: { reason, central_callback: true } }],
    });
    const redirect = NextResponse.redirect(new URL(`${loginPath}?error=exchange_failed`, request.url));
    applyPendingAuthCookies(redirect, pending);
    return redirect;
  }

  const user = data.session.user;
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  const isNew = Date.now() - createdAt < 120_000;
  const provider =
    state.provider ||
    (user.app_metadata?.provider as string | undefined) ||
    (user.identities?.[0]?.provider as string | undefined) ||
    null;

  const admin = createServiceRoleClient();
  const { data: published } = admin
    ? await admin
        .from("published_apps" as never)
        .select("owner_id")
        .eq("id", state.publishedAppId)
        .maybeSingle()
    : { data: null };

  const ownerId = (published as { owner_id?: string } | null)?.owner_id ?? "";

  const sync = await syncAppUserProfile({
    projectId: state.projectId,
    ownerId,
    publishedAppId: state.publishedAppId,
    slug: state.slug,
    user,
    provider,
    eventType: isNew ? "signup_success" : "login_success",
  });

  if (!sync.ok) {
    await recordPublishedAuthError(state.projectId, sync.error ?? "profile_sync_failed");
  }

  const dest = state.returnUrl.startsWith("/") ? state.returnUrl : `/p/${state.slug}`;
  const redirect = NextResponse.redirect(new URL(dest, request.url));
  applyPendingAuthCookies(redirect, pending);
  redirect.cookies.set(
    PUBLISHED_OAUTH_COOKIE,
    "",
    applyAuthCookieOptions({ maxAge: 0, path: "/" }, request, 0),
  );
  return redirect;
}

export function attachPublishedOAuthCookie(
  response: NextResponse,
  stateToken: string,
  request: NextRequest,
): void {
  response.cookies.set(
    PUBLISHED_OAUTH_COOKIE,
    stateToken,
    applyAuthCookieOptions({ maxAge: 600, path: "/", httpOnly: true, sameSite: "lax" }, request, 600),
  );
}
