/** Canonical product URLs for emails, inbox templates, and admin CTAs. */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "https://vodex.dev";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
}

export function getDiscordInviteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ||
    process.env.DISCORD_INVITE_URL?.trim() ||
    "https://discord.gg/TzV73DfWG6"
  );
}

export const CANONICAL_ROUTES = {
  home: "/",
  create: "/create",
  templates: "/templates",
  billing: "/settings/billing",
  pricing: "/pricing",
  settingsBilling: "/settings?tab=billing",
  adminControlCenter: "/admin",
  statusPage: "https://status.vodex.dev",
  publicStatus: "/status",
  discord: getDiscordInviteUrl(),
} as const;
