import {
  CONTACT_NOTIFICATIONS_TO,
  DEFAULT_EMAIL_FROM,
  SUPPORT_EMAIL,
} from "@/lib/branding/brand-assets";

/** Server-only email configuration (never import from client components). */
export type EmailConfig = {
  resendApiKey: string | null;
  from: string;
  contactNotificationsTo: string;
  supportEmail: string;
  platformContactCopy: boolean;
  isProduction: boolean;
};

export function getEmailConfig(): EmailConfig {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || null;
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    DEFAULT_EMAIL_FROM;
  const contactNotificationsTo =
    process.env.CONTACT_NOTIFICATIONS_TO?.trim() || CONTACT_NOTIFICATIONS_TO;
  const supportEmail =
    process.env.SUPPORT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    SUPPORT_EMAIL;
  const platformContactCopy =
    process.env.PLATFORM_CONTACT_COPY?.trim() === "1" ||
    process.env.PLATFORM_CONTACT_COPY?.trim()?.toLowerCase() === "true";

  return {
    resendApiKey,
    from,
    contactNotificationsTo,
    supportEmail,
    platformContactCopy,
    isProduction: process.env.NODE_ENV === "production",
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(getEmailConfig().resendApiKey);
}

/** DNS guidance shown in admin — receiving stays disabled on Resend. */
export const RESEND_DNS_SENDING_GUIDANCE = [
  "Receiving stays disabled on Resend.",
  "Add only sending DNS records for your domain:",
  "TXT  resend._domainkey  (DKIM)",
  "MX   send               (sending subdomain)",
  "TXT  send               (SPF for send subdomain)",
  "Do not change root MX records used for Gmail/workspace receiving.",
] as const;
