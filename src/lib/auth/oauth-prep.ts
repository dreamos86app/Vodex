import {
  DREAMOS_REF_COOKIE,
  DREAMOS_REF_STORAGE_KEY,
  persistReferralCodeForBrowser,
  readRefCodeFromCookieHeader,
} from "@/lib/auth/ref-cookie";
import { getCanonicalOAuthCallbackUrl } from "@/lib/auth/oauth-redirect";
import { logAuthEvent } from "@/lib/auth/auth-diagnostics";

/** Client sessionStorage key for post-OAuth return path (mirrors cookie). */
export const DREAMOS_AUTH_RETURN_TO_STORAGE = "dreamos_auth_return_to";

/** Short-lived cookie so /auth/callback can redirect without ?next= on redirectTo. */
export const DREAMOS_RETURN_TO_COOKIE = "dreamos_auth_return_to";

const OAUTH_PREP_KEYS = new Set(["ref", "referral", "referral_code"]);

/**
 * Allow only same-origin relative paths. Strips referral query params from return URLs.
 */
export function safeAuthReturnPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://") || /^javascript:/i.test(trimmed)) return null;

  try {
    const u = new URL(trimmed, "http://oauth-return.invalid");
    if (u.hostname !== "oauth-return.invalid") return null;
    if (u.pathname.startsWith("/auth")) return null;

    for (const key of [...u.searchParams.keys()]) {
      if (OAUTH_PREP_KEYS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }

    const qs = u.searchParams.toString();
    const path = `${u.pathname}${qs ? `?${qs}` : ""}`;
    return path.length > 512 ? null : path;
  } catch {
    return null;
  }
}

export function readAuthReturnToFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(`${DREAMOS_RETURN_TO_COOKIE}=`)) continue;
    try {
      const v = decodeURIComponent(p.slice(DREAMOS_RETURN_TO_COOKIE.length + 1));
      return safeAuthReturnPath(v);
    } catch {
      return null;
    }
  }
  return null;
}

export function persistAuthReturnToForBrowser(path: string): void {
  if (typeof document === "undefined") return;
  const safe = safeAuthReturnPath(path);
  if (!safe) return;

  try {
    window.sessionStorage.setItem(DREAMOS_AUTH_RETURN_TO_STORAGE, safe);
  } catch {
    /* ignore */
  }

  const secure = window.location.protocol === "https:";
  document.cookie = `${DREAMOS_RETURN_TO_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=3600; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function captureReferralFromLocationSearch(search: string): string | null {
  if (!search) return null;
  try {
    const ref = new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("ref");
    if (!ref?.trim()) return null;
    persistReferralCodeForBrowser(ref);
    return ref.trim().toUpperCase();
  } catch {
    return null;
  }
}

export type OAuthSignInPrepared = {
  redirectTo: string;
  returnTo: string | null;
  referralCode: string | null;
};

/**
 * Client-only: persist referral + return path, return canonical OAuth redirectTo (no query).
 */
export function prepareClientOAuthSignIn(
  returnTo?: string | null,
  provider: "google" | "github" | "unknown" = "unknown",
): OAuthSignInPrepared {
  let referralCode: string | null = null;
  let safeReturn: string | null = safeAuthReturnPath(returnTo ?? null);

  if (typeof window !== "undefined") {
    referralCode = captureReferralFromLocationSearch(window.location.search);
    if (!referralCode) {
      try {
        const stored = window.localStorage.getItem(DREAMOS_REF_STORAGE_KEY);
        if (stored?.trim()) referralCode = stored.trim().toUpperCase();
      } catch {
        /* ignore */
      }
    }
    if (!referralCode) {
      referralCode = readRefCodeFromCookieHeader(document.cookie);
    }

    if (!safeReturn) {
      try {
        const fromStorage = window.sessionStorage.getItem(DREAMOS_AUTH_RETURN_TO_STORAGE);
        safeReturn = safeAuthReturnPath(fromStorage);
      } catch {
        /* ignore */
      }
    }

    if (!safeReturn) {
      const fromUrl = new URLSearchParams(window.location.search).get("next");
      safeReturn = safeAuthReturnPath(fromUrl);
    }

    if (safeReturn) {
      persistAuthReturnToForBrowser(safeReturn);
    }

    logOAuthStartDiagnostics(provider, {
      redirectTo: getCanonicalOAuthCallbackUrl(),
      returnTo: safeReturn,
      referralCodeDetected: referralCode,
      callbackOrigin: window.location.origin,
    });
  }

  return {
    redirectTo: getCanonicalOAuthCallbackUrl(),
    returnTo: safeReturn,
    referralCode,
  };
}

export function logOAuthStartDiagnostics(
  provider: "google" | "github" | "unknown",
  meta: {
    redirectTo: string;
    returnTo: string | null;
    referralCodeDetected: string | null;
    callbackOrigin: string;
  },
): void {
  if (process.env.NODE_ENV === "production") return;

  const redirect = meta.redirectTo.replace(/\?.*$/, "");
  if (meta.redirectTo !== redirect) {
    logAuthEvent(
      "auth_redirect_mismatch",
      { reason: "redirectTo_must_not_include_query", oauth_start_redirect_to: redirect },
      "warn",
    );
  }

  logAuthEvent("oauth_started", {
    provider,
    oauth_start_redirect_to: meta.redirectTo,
    return_to: meta.returnTo,
    referral_code_detected: meta.referralCodeDetected,
    callback_origin: meta.callbackOrigin,
  });
}

export function resolvePostAuthDestination(
  nextFromQuery: string | null,
  cookieHeader: string | null,
): string {
  const fromQuery = safeAuthReturnPath(nextFromQuery);
  if (fromQuery) return fromQuery;

  const fromCookie = readAuthReturnToFromCookieHeader(cookieHeader);
  if (fromCookie) return fromCookie;

  return "/";
}

/** Cookie names cleared after successful OAuth callback redirect. */
export const OAUTH_EPHEMERAL_COOKIES = [DREAMOS_REF_COOKIE, DREAMOS_RETURN_TO_COOKIE] as const;
