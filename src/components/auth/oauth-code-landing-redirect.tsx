"use client";

import { useEffect } from "react";
import { buildAuthCallbackRedirectFromSearchParams } from "@/lib/auth/oauth-redirect";
import { isOAuthCodeOnNonCallbackPath } from "@/lib/auth/oauth-origin-guard";
import { isLocalhostOrigin } from "@/lib/url/app-origin";

const PRODUCTION_APP_ORIGIN = "https://dreamos86.com";

/**
 * Safety net when Supabase lands PKCE on Site URL (e.g. /?code=) instead of /auth/callback.
 * If the browser is on localhost after production sign-in, send the user to production login
 * with a clear error (the one-time code cannot be exchanged on the wrong host).
 */
export function OAuthCodeLandingRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return;
    if (!isOAuthCodeOnNonCallbackPath(window.location.pathname)) return;

    if (isLocalhostOrigin(window.location.origin)) {
      const login = new URL("/auth/login", PRODUCTION_APP_ORIGIN);
      login.searchParams.set("error", "supabase_site_url_localhost");
      window.location.replace(login.toString());
      return;
    }

    const dest = buildAuthCallbackRedirectFromSearchParams(
      params,
      window.location.origin,
    );
    if (dest) {
      window.location.replace(dest);
    }
  }, []);

  return null;
}
