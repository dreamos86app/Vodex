/**
 * DreamOS86 — Canonical app URL
 *
 * Used for all user-facing links: auth redirects, referral URLs,
 * share links, email callbacks, and preview URLs.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL  (set in Vercel env vars)
 *  2. VERCEL_PROJECT_PRODUCTION_URL (auto-set by Vercel, no https://)
 *  3. localhost:3000  (local dev only — never reaches production)
 */

export function getAppUrl(): string {
  if (typeof process !== "undefined") {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
  }
  // Browser fallback — use actual origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR fallback — should never hit in production if NEXT_PUBLIC_APP_URL is set
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "https://dreamos86.com";
}

/** Build an absolute URL from a path. */
export function appUrl(path: string): string {
  const base = getAppUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
