/**
 * Vodex platform owner — safe for client and server imports.
 * Override with ADMIN_OWNER_EMAIL in production.
 */
import {
  LEGACY_PLATFORM_OWNER_EMAIL,
  LEGACY_PREVIOUS_OWNER_EMAIL,
} from "@/lib/brand/legacy-brand-allowlist";

export const DREAMOS_OWNER_EMAIL = LEGACY_PLATFORM_OWNER_EMAIL;

/** Full status page + admin control — explicit owner inboxes. */
const FULL_STATUS_OWNER_EMAILS = new Set(
  [
    LEGACY_PLATFORM_OWNER_EMAIL,
    "dreamos86@gmail.com",
    "vodexlabs@gmail.com",
    LEGACY_PREVIOUS_OWNER_EMAIL,
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const OWNER_EMAILS = new Set(FULL_STATUS_OWNER_EMAILS);

export function isDreamosOwnerEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return OWNER_EMAILS.has(normalized);
}

/** Owners see full grouped status with 30-day history; everyone else sees the public summary. */
export function canViewFullStatusPage(email: string | null | undefined): boolean {
  return isDreamosOwnerEmail(email);
}

/** @alias */
export const isVodexOwnerEmail = isDreamosOwnerEmail;
