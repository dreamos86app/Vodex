/**
 * @legacy-migration Internal legacy platform identifiers for redirects, host detection,
 * and platform-owner auth. Not shown in user-facing UI copy.
 */

import { ADMIN_OWNER_EMAIL, APP_URL } from "@/lib/brand/brand-config";

/** Legacy platform hosts that should redirect to vodex.dev. */
export const LEGACY_DREAMOS86_PLATFORM_HOSTS = [
  "dreamos86.com",
  "www.dreamos86.com",
] as const;

export const LEGACY_DREAMOS86_AUTH_HOSTS = ["auth.dreamos86.com"] as const;

export const LEGACY_PUBLISHED_APP_ROOT_DOMAINS = ["dreamos86.app"] as const;

export const LEGACY_REDIRECT_ORIGINS = [
  "https://dreamos86.com",
  "https://www.dreamos86.com",
] as const;

/** Platform owner inbox — set ADMIN_OWNER_EMAIL in production. */
export const LEGACY_PLATFORM_OWNER_EMAIL =
  process.env.ADMIN_OWNER_EMAIL?.trim() || ADMIN_OWNER_EMAIL;

/**
 * @legacy-migration Prior owner inbox — still grants admin until fully migrated in Supabase.
 * Never shown in user-facing UI.
 */
export const LEGACY_PREVIOUS_OWNER_EMAIL = "dreamos86app@gmail.com";

export function isLegacyPlatformHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return LEGACY_DREAMOS86_PLATFORM_HOSTS.some(
    (d) => h === d || h.endsWith(`.${d}`),
  );
}

export function isProductionPlatformHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "vodex.dev" || h === "www.vodex.dev") return true;
  return isLegacyPlatformHostname(h);
}

/** Map legacy production host to canonical Vodex origin. */
export function canonicalizePlatformOrigin(origin: string): string {
  try {
    const host = new URL(origin).hostname;
    if (isLegacyPlatformHostname(host)) return APP_URL;
  } catch {
    /* ignore */
  }
  return origin.replace(/\/$/, "");
}
