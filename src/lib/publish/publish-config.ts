export const PLATFORM_BASE_DOMAIN = "dreamos86.com";

/** Wildcard only when DNS is verified — path mode is default. */
export function wildcardSubdomainEnabled(): boolean {
  return (
    process.env.DREAMOS_WILDCARD_SUBDOMAIN === "1" && process.env.DREAMOS_DNS_VERIFIED === "1"
  );
}

/** Show "Built with DreamOS86" badge on public apps (default on). */
export function publicAppBadgeEnabled(): boolean {
  return process.env.DREAMOS_PUBLIC_BADGE !== "0";
}

export const RESERVED_PUBLISH_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "dashboard",
  "create",
  "apps",
  "app",
  "p",
  "publish",
  "settings",
  "billing",
  "support",
  "www",
  "help",
  "pricing",
  "projects",
]);
