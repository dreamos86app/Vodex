import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { getAppUrl } from "@/lib/app-url";
import { getCanonicalOAuthRedirectTo } from "@/lib/auth/oauth-redirect";
import { usesDefaultSupabaseProjectHost, getSupabasePublicUrl } from "@/lib/supabase/auth-domain";
import { safeFetch } from "@/lib/network/safe-fetch";

export type ProviderStatus = "enabled" | "disabled" | "unknown";

export interface AuthHealthResult {
  env: {
    supabaseUrl: boolean;
    supabaseKey: boolean;
    appUrl: boolean;
    appUrlValue: string | null;
  };
  session: {
    active: boolean;
    userId: string | null;
    email: string | null;
  };
  providers: {
    google: ProviderStatus;
    github: ProviderStatus;
  };
  routes: {
    callback: boolean;
    resetPassword: boolean;
    forgot: boolean;
  };
  middleware: boolean;
  checkedAt: string;
  oauthBranding?: {
    usesDefaultSupabaseHost: boolean;
    supabaseUrlHost: string | null;
    hint: string | null;
  };
  /** Shown when GitHub OAuth is enabled — favicon does not control GitHub's OAuth screen. */
  githubOAuthLogoNote: string | null;
}

/**
 * Probe whether an OAuth provider is enabled by using Supabase's
 * signInWithOAuth with skipBrowserRedirect: true.
 *
 * - Returns a redirect URL  → provider is enabled
 * - Returns an error about "not enabled" → provider is disabled
 * - Other error → unknown
 */
async function probeProvider(
  supabaseUrl: string,
  supabaseKey: string,
  provider: "google" | "github",
  redirectTo: string,
): Promise<ProviderStatus> {
  try {
    // Use the REST API directly to get an OAuth URL — this does not redirect
    // and tells us immediately if the provider is configured.
    const { response: res } = await safeFetch(
      `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          "Content-Type": "application/json",
        },
        redirect: "manual",
      },
      `auth_health_oauth_probe_${provider}`,
    );

    if (!res) return "unknown";

    // 302 → provider is configured and returned a redirect URL
    // 400 / 422 → provider not enabled or invalid
    if (res.status === 302 || res.status === 301) return "enabled";
    if (res.status >= 400) {
      const text = await res.text().catch(() => "");
      if (
        text.toLowerCase().includes("not enabled") ||
        text.toLowerCase().includes("unsupported provider") ||
        text.toLowerCase().includes("provider") 
      ) {
        return "disabled";
      }
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET(request: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const supabase = await createClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const appUrlEnv = process.env.NEXT_PUBLIC_APP_URL ?? getAppUrl();
  const callbackUrl = getCanonicalOAuthRedirectTo();

  // ?probe=google|github — re-check just one provider for the test button
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") as "google" | "github" | null;

  // Session check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let googleStatus: ProviderStatus;
  let githubStatus: ProviderStatus;

  if (probe === "google") {
    googleStatus = await probeProvider(supabaseUrl, supabaseKey, "google", callbackUrl);
    githubStatus = "unknown";
  } else if (probe === "github") {
    googleStatus = "unknown";
    githubStatus = await probeProvider(supabaseUrl, supabaseKey, "github", callbackUrl);
  } else {
    // Full check — run both in parallel
    [googleStatus, githubStatus] = await Promise.all([
      probeProvider(supabaseUrl, supabaseKey, "google", callbackUrl),
      probeProvider(supabaseUrl, supabaseKey, "github", callbackUrl),
    ]);
  }

  let supabaseUrlHost: string | null = null;
  try {
    supabaseUrlHost = getSupabasePublicUrl() ? new URL(getSupabasePublicUrl()!).hostname : null;
  } catch {
    supabaseUrlHost = null;
  }
  const usesDefaultHost = usesDefaultSupabaseProjectHost();

  const result: AuthHealthResult = {
    env: {
      supabaseUrl: Boolean(supabaseUrl),
      supabaseKey: Boolean(supabaseKey),
      appUrl: Boolean(appUrlEnv),
      appUrlValue: appUrlEnv,
    },
    session: {
      active: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
    },
    providers: {
      google: googleStatus,
      github: githubStatus,
    },
    routes: {
      callback: true,
      resetPassword: true,
      forgot: true,
    },
    middleware: true,
    checkedAt: new Date().toISOString(),
    oauthBranding: {
      usesDefaultSupabaseHost: usesDefaultHost,
      supabaseUrlHost,
      hint: usesDefaultHost
        ? "OAuth branding still uses the Supabase project URL. Configure a Supabase custom domain (e.g. auth.dreamos86.com) and set NEXT_PUBLIC_SUPABASE_URL — see docs/supabase-custom-auth-domain.md."
        : null,
    },
    githubOAuthLogoNote:
      githubStatus === "enabled"
        ? "GitHub OAuth logo must be updated in GitHub Developer Settings → OAuth Apps → Application logo. Favicon and in-app icon changes do not update GitHub's OAuth screen. See docs/oauth-branding-icons.md."
        : null,
  };

  return NextResponse.json(result);
}
