import { resolveAppOrigin } from "@/lib/url/app-origin";

/** Params that must never be forwarded onto /auth/callback from Site URL OAuth landings. */
const OAUTH_CALLBACK_STRIP_PARAMS = new Set(["ref", "referral", "referral_code"]);

/**
 * OAuth redirect base — browser uses live origin; server uses resolveAppOrigin (localhost in dev).
 */
export function getOAuthBaseUrl(requestUrl?: string): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return resolveAppOrigin(requestUrl);
}

/**
 * Canonical OAuth callback — fixed path, no user-specific query (referral/return use cookies).
 */
export function getCanonicalOAuthCallbackUrl(requestUrl?: string): string {
  return `${getOAuthBaseUrl(requestUrl)}/auth/callback`;
}

/**
 * @deprecated For OAuth use getCanonicalOAuthCallbackUrl(). Optional next is only for non-OAuth email links.
 */
export function getCallbackUrl(next?: string, requestUrl?: string): string {
  const base = getCanonicalOAuthCallbackUrl(requestUrl);
  if (!next?.trim()) return base;
  const safe = next.trim();
  if (!safe.startsWith("/") || safe.startsWith("//") || safe.includes("://")) {
    return base;
  }
  return `${base}?next=${encodeURIComponent(safe)}`;
}

export function getPasswordResetUrl(requestUrl?: string): string {
  return `${getOAuthBaseUrl(requestUrl)}/auth/callback?type=recovery`;
}

/** If Supabase lands OAuth on `/?code=...`, forward to the real callback handler. */
export function buildAuthCallbackRedirectFromSearchParams(
  searchParams: URLSearchParams,
  requestUrl: string,
): string | null {
  if (!searchParams.has("code")) return null;
  const callback = new URL("/auth/callback", requestUrl);
  searchParams.forEach((value, key) => {
    if (OAUTH_CALLBACK_STRIP_PARAMS.has(key.toLowerCase())) return;
    callback.searchParams.set(key, value);
  });
  return callback.pathname + callback.search;
}
