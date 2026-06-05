import { type NextRequest, NextResponse } from "next/server";
import { loadPublishedAppBySlug } from "@/lib/publish/published-app-runtime";
import { publishedAuthBasePath } from "@/lib/publish/published-auth-config";
import { syncAppUserProfile } from "@/lib/publish/app-user-profile-sync";
import { recordPublishedAnalyticsEvents } from "@/lib/publish/published-analytics-server";
import {
  clearPublishedAuthError,
  recordPublishedAuthError,
} from "@/lib/publish/published-auth-diagnostics";
import {
  applyPendingAuthCookies,
  createRouteHandlerClient,
  type PendingAuthCookie,
} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

/**
 * Published app OAuth PKCE callback — exchanges code, syncs app_user_profiles, redirects to app.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug) return new NextResponse("Not found", { status: 404 });

  const published = await loadPublishedAppBySlug(slug);
  if (!published) return new NextResponse("Not found", { status: 404 });

  const base = publishedAuthBasePath(published.public_url, slug);
  const loginPath = base ? `${base}/login` : "/login";

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const rawFrom = searchParams.get("from_url") ?? searchParams.get("from") ?? (base || "/");
  const fromUrl =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : base || "/";

  if (providerError) {
    await recordPublishedAuthError(published.project_id, `OAuth provider error: ${providerError}`);
    await recordPublishedAnalyticsEvents({
      slug,
      projectId: published.project_id,
      ownerId: published.owner_id,
      publishedAppId: published.id,
      events: [{ event_type: "auth_error", meta: { reason: providerError } }],
    });
    return NextResponse.redirect(`${loginPath}?error=${encodeURIComponent(providerError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${loginPath}?error=missing_code`);
  }

  const pending: PendingAuthCookie[] = [];
  const redirectUrl = new URL(fromUrl, request.url);
  const response = NextResponse.redirect(redirectUrl);

  try {
    const supabase = createRouteHandlerClient(request, response, pending);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session?.user) {
      const reason = error?.message ?? "exchange_failed";
      await recordPublishedAuthError(published.project_id, reason);
      await recordPublishedAnalyticsEvents({
        slug,
        projectId: published.project_id,
        ownerId: published.owner_id,
        publishedAppId: published.id,
        events: [{ event_type: "auth_error", meta: { reason } }],
      });
      return NextResponse.redirect(`${loginPath}?error=exchange_failed`);
    }

    const user = data.session.user;
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const isNew = Date.now() - createdAt < 120_000;
    const provider =
      (user.app_metadata?.provider as string | undefined) ??
      (user.identities?.[0]?.provider as string | undefined) ??
      null;

    const sync = await syncAppUserProfile({
      projectId: published.project_id,
      ownerId: published.owner_id,
      publishedAppId: published.id,
      slug,
      user,
      provider,
      eventType: isNew ? "signup_success" : "login_success",
    });
    if (!sync.ok) {
      await recordPublishedAuthError(published.project_id, sync.error ?? "profile_sync_failed");
    } else {
      await clearPublishedAuthError(published.project_id);
    }

    applyPendingAuthCookies(response, pending);
    return response;
  } catch (e) {
    console.error("[published-auth-callback]", e);
    await recordPublishedAuthError(published.project_id, "server_error");
    return NextResponse.redirect(`${loginPath}?error=server_error`);
  }
}
