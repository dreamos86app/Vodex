import {
  applyAuthCookieOptions,
  formatAuthCookieDirective,
  getAuthCookieOptions,
} from "@/lib/auth/auth-cookie-options";

/** Short-lived referral capture cookie (server + client share name only). */
export const DREAMOS_REF_COOKIE = "dreamos_ref_code";
export const DREAMOS_REF_STORAGE_KEY = "dreamos-ref-code";
const SESSION_REFERRAL_KEY = "dreamos_referral_code";

export function sanitizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length < 4 || c.length > 16) return null;
  return c;
}

export function readRefCodeFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(`${DREAMOS_REF_COOKIE}=`)) continue;
    try {
      const v = decodeURIComponent(p.slice(DREAMOS_REF_COOKIE.length + 1));
      return sanitizeReferralCode(v);
    } catch {
      return null;
    }
  }
  return null;
}

/** Client: persist ref for OAuth round-trip + legacy localStorage. */
export function persistReferralCodeForBrowser(code: string): void {
  const c = sanitizeReferralCode(code);
  if (!c) return;
  try {
    window.localStorage.setItem(DREAMOS_REF_STORAGE_KEY, c);
    window.sessionStorage.setItem(SESSION_REFERRAL_KEY, c);
  } catch {
    /* ignore */
  }
  const flags = formatAuthCookieDirective(getAuthCookieOptions());
  document.cookie = `${DREAMOS_REF_COOKIE}=${encodeURIComponent(c)}; ${flags}`;
}

export function clearPendingReferralForBrowser(): void {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.removeItem(DREAMOS_REF_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_REFERRAL_KEY);
    window.sessionStorage.removeItem("dreamos_auth_return_to");
  } catch {
    /* ignore */
  }
  const flags = formatAuthCookieDirective(getAuthCookieOptions(), 0);
  document.cookie = `${DREAMOS_REF_COOKIE}=; ${flags}`;
}

export function readReferralCodeFromBrowserCookie(): string | null {
  if (typeof document === "undefined") return null;
  return readRefCodeFromCookieHeader(document.cookie);
}

/** Server: clear referral cookie on redirect response. */
export function clearReferralCookieOnResponse(
  response: {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  },
  originOrRequest?: Parameters<typeof getAuthCookieOptions>[0],
): void {
  response.cookies.set(
    DREAMOS_REF_COOKIE,
    "",
    applyAuthCookieOptions({ maxAge: 0 }, originOrRequest, 0),
  );
}
