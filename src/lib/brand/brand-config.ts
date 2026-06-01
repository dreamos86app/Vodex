/**
 * Canonical Vodex brand — single source of truth for UI, legal, email, and backend fallbacks.
 */

export const BRAND_NAME = "Vodex";

export const LEGAL_COMPANY_NAME = "Vodex Labs";

export const APP_DOMAIN = "vodex.dev";

export const APP_URL = `https://${APP_DOMAIN}`;

export const SUPPORT_EMAIL = "support@vodex.dev";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}` as const;

/** Platform owner inbox — admin OTPs and critical confirmations. */
export const ADMIN_OWNER_EMAIL = "vodexlabs@gmail.com";

/** Internal contact / security notifications (not end-user support). */
export const CONTACT_NOTIFICATIONS_TO = ADMIN_OWNER_EMAIL;

/** Resend / transactional sender (server env should match). */
export const RESEND_FROM_EMAIL = `Vodex <${SUPPORT_EMAIL}>`;

export const EMAIL_FROM = RESEND_FROM_EMAIL;

/** Wildcard hostname root for published generated apps (not the platform domain). */
export const PUBLISHED_APP_ROOT_DOMAIN = "vodex.app";

/** Historical brand strings — for migration tooling only. */
export const OLD_BRAND_NAMES = [
  "DreamOS86",
  "dreamos86",
  "DreamOS86app",
  "dreamos86app",
] as const;

/** Historical domains — redirect/migration only; never canonical. */
export const OLD_DOMAINS = [
  "dreamos86.com",
  "www.dreamos86.com",
  "auth.dreamos86.com",
  "dreamos86.app",
  "dreamos86app.vercel.app",
] as const;

export const PRODUCTION_WEBHOOK_PATH = "/api/webhooks/paddle";

export function productionWebhookUrl(): string {
  return `${APP_URL}${PRODUCTION_WEBHOOK_PATH}`;
}

export function productionAuthCallbackUrl(): string {
  return `${APP_URL}/auth/callback`;
}

export function publishedAppExampleUrl(slug = "your-app"): string {
  return `https://${slug}.${PUBLISHED_APP_ROOT_DOMAIN}`;
}

/** Legal/marketing copy — published preview on vodex.dev subdomains */
export const PUBLISHED_APP_EXAMPLE_HOST = `your-app.${APP_DOMAIN}`;

/** Enterprise / custom plans (above self-serve Infinity VII ~$1,235/mo). */
export const ENTERPRISE_PRICING_START_USD = 1_500;
export const ENTERPRISE_PRICING_START_LABEL = "$1,500/month";
export const ENTERPRISE_PRICING_RANGE_LABEL = "$1,500–$10,000+/month";
