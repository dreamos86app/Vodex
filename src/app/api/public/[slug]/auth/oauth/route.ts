import { type NextRequest, NextResponse } from "next/server";
import { loadPublishedAppBySlug } from "@/lib/publish/published-app-runtime";
import { publishedAuthCallbackUrl } from "@/lib/publish/published-auth-config";
import { recordPublishedAuthError } from "@/lib/publish/published-auth-diagnostics";
import {
  getCentralOAuthCallbackUrl,
  useCentralPublishedOAuth,
} from "@/lib/publish/central-oauth-config";
import { buildPublishedOAuthState } from "@/lib/publish/central-oauth-state";
import { attachPublishedOAuthCookie } from "@/lib/publish/published-oauth-callback-handler";
import {
  applyPendingAuthCookies,
  createRouteHandlerClient,
  type PendingAuthCookie,
} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["google", "github", "apple", "azure", "facebook", "discord"]);

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const published = await loadPublishedAppBySlug(slug);
  if (!published) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = request.nextUrl.searchParams.get("provider")?.toLowerCase() ?? "";
  if (!ALLOWED.has(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const rawFrom = request.nextUrl.searchParams.get("from_url") ?? "/";
  const fromUrl =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : `/p/${slug}`;

  const useCentral = useCentralPublishedOAuth();
  const legacyCallback = `${publishedAuthCallbackUrl(published.public_url, slug)}?from_url=${encodeURIComponent(fromUrl)}`;

  let callbackUrl = legacyCallback;
  let stateToken: string | null = null;

  if (useCentral) {
    stateToken = buildPublishedOAuthState({
      projectId: published.project_id,
      publishedAppId: published.id,
      slug,
      returnUrl: fromUrl,
      provider,
    });
    callbackUrl = `${getCentralOAuthCallbackUrl()}?vodex_state=${encodeURIComponent(stateToken)}`;
  }

  const pending: PendingAuthCookie[] = [];
  const response = NextResponse.redirect(new URL("/", request.url));

  try {
    const supabase = createRouteHandlerClient(request, response, pending);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as "google",
      options: { redirectTo: callbackUrl },
    });

    if (error || !data.url) {
      const msg = error?.message ?? "OAuth start failed";
      await recordPublishedAuthError(published.project_id, msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const redirect = NextResponse.redirect(data.url);
    applyPendingAuthCookies(redirect, pending);
    if (stateToken) {
      attachPublishedOAuthCookie(redirect, stateToken, request);
    }
    return redirect;
  } catch (e) {
    console.error("[published-auth-oauth]", e);
    await recordPublishedAuthError(published.project_id, "OAuth unavailable");
    return NextResponse.json({ error: "OAuth unavailable" }, { status: 503 });
  }
}
