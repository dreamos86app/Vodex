/**
 * Vodex platform owner — safe for client and server imports.
 * Override with ADMIN_OWNER_EMAIL in production.
 */
import {
  LEGACY_PLATFORM_OWNER_EMAIL,
  LEGACY_PREVIOUS_OWNER_EMAIL,
} from "@/lib/brand/legacy-brand-allowlist";

export const DREAMOS_OWNER_EMAIL = LEGACY_PLATFORM_OWNER_EMAIL;

const OWNER_EMAILS = new Set(
  [LEGACY_PLATFORM_OWNER_EMAIL, LEGACY_PREVIOUS_OWNER_EMAIL]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isDreamosOwnerEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return OWNER_EMAILS.has(normalized);
}

/** @alias */
export const isVodexOwnerEmail = isDreamosOwnerEmail;
