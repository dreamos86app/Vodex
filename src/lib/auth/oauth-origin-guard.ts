import { isLocalhostOrigin } from "@/lib/url/app-origin";

const PRODUCTION_PUBLIC_HOSTS = new Set(["dreamos86.com", "www.dreamos86.com"]);

export function isProductionPublicHost(hostname: string): boolean {
  return PRODUCTION_PUBLIC_HOSTS.has(hostname.toLowerCase());
}

/** Compare hosts for OAuth redirectTo vs the tab that started sign-in. */
export function oauthRedirectHostsMatch(
  redirectTo: string,
  browserOrigin: string,
): boolean {
  try {
    const redirectHost = new URL(redirectTo).hostname.toLowerCase();
    const browserHost = new URL(browserOrigin).hostname.toLowerCase();
    if (redirectHost === browserHost) return true;
    if (
      isProductionPublicHost(redirectHost) &&
      isProductionPublicHost(browserHost)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type OAuthRedirectValidation =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Block OAuth start when the tab is on production but redirectTo points at localhost
 * (misbuilt env or wrong tab).
 */
export function validateOAuthRedirectForBrowser(
  redirectTo: string,
): OAuthRedirectValidation {
  if (typeof window === "undefined") return { ok: true };

  const origin = window.location.origin;
  if (oauthRedirectHostsMatch(redirectTo, origin)) return { ok: true };

  const onProductionTab = isProductionPublicHost(new URL(origin).hostname);
  let redirectIsLocal = false;
  try {
    redirectIsLocal = isLocalhostOrigin(new URL(redirectTo).origin);
  } catch {
    redirectIsLocal = false;
  }

  if (onProductionTab && redirectIsLocal) {
    return {
      ok: false,
      code: "oauth_redirect_localhost_on_production",
      message:
        "Sign-in is misconfigured: this page is on dreamos86.com but OAuth would return to localhost. Redeploy with NEXT_PUBLIC_APP_URL=https://dreamos86.com and retry.",
    };
  }

  return {
    ok: false,
    code: "oauth_redirect_host_mismatch",
    message:
      "Sign-in redirect does not match this site. Use https://dreamos86.com to sign up, or fix Supabase Auth URL configuration.",
  };
}

/** True when Supabase likely used Site URL instead of /auth/callback (/?code= landing). */
export function isOAuthCodeOnNonCallbackPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  return path !== "/auth/callback";
}
