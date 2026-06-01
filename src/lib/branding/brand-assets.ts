/**
 * Brand assets & metadata — re-exports canonical config + icon URLs.
 */

import {
  BRAND_NAME,
  LEGAL_COMPANY_NAME,
  APP_DOMAIN,
  APP_URL,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  RESEND_FROM_EMAIL,
  EMAIL_FROM,
  ADMIN_OWNER_EMAIL,
  CONTACT_NOTIFICATIONS_TO,
  PUBLISHED_APP_ROOT_DOMAIN,
  OLD_BRAND_NAMES,
  OLD_DOMAINS,
} from "@/lib/brand/brand-config";

export {
  BRAND_NAME,
  LEGAL_COMPANY_NAME,
  APP_DOMAIN,
  APP_URL,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  RESEND_FROM_EMAIL,
  EMAIL_FROM,
  ADMIN_OWNER_EMAIL,
  CONTACT_NOTIFICATIONS_TO,
  PUBLISHED_APP_ROOT_DOMAIN,
  OLD_BRAND_NAMES,
  OLD_DOMAINS,
};

/** @deprecated Use EMAIL_FROM */
export const DEFAULT_EMAIL_FROM = EMAIL_FROM;

/** Cache-bust query for PNG brand marks after asset updates. */
export const BRAND_ICON_VERSION = "3";

/** UI lockups — always use transparent master (no matte/black tile). */
export const VODEX_BRAND_ICON_UI_SRC = `/brand/vodex-icon-transparent.png?v=${BRAND_ICON_VERSION}`;

export const VODEX_BRAND_ICON_SRC = `/brand/vodex-icon.png?v=${BRAND_ICON_VERSION}`;

export const VODEX_BRAND_ICON_TRANSPARENT_SRC = VODEX_BRAND_ICON_UI_SRC;

export const VODEX_ICON_192 = `/brand/vodex-icon-192.png?v=${BRAND_ICON_VERSION}`;

export const VODEX_ICON_512 = `/brand/vodex-icon-512.png?v=${BRAND_ICON_VERSION}`;

export const VODEX_ICON_MASKABLE = `/brand/vodex-icon-maskable.png?v=${BRAND_ICON_VERSION}`;

export const BRAND_TAGLINE =
  "Vodex is the AI-native platform for building software. Describe what you want — frontier AI architects, builds, and deploys it in minutes.";

export const BRAND_KEYWORDS = [
  "AI",
  "app builder",
  "Vodex",
  "code generation",
  "Next.js",
  "Supabase",
  "Vercel",
] as const;
