/** Public app hostname root — prefer .app, override via env. */
export function getPublicAppRootDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN?.trim() ||
    process.env.PUBLIC_APP_ROOT_DOMAIN?.trim() ||
    "vodex.app"
  );
}

export const PLATFORM_BASE_DOMAIN = getPublicAppRootDomain();

/** Wildcard only when DNS is verified — path mode is default. */
export function wildcardSubdomainEnabled(): boolean {
  const wildcard =
    process.env.VODEX_WILDCARD_SUBDOMAIN === "1" || process.env.DREAMOS_WILDCARD_SUBDOMAIN === "1";
  const dnsVerified =
    process.env.VODEX_DNS_VERIFIED === "1" || process.env.DREAMOS_DNS_VERIFIED === "1";
  return wildcard && dnsVerified;
}

/** Supabase custom auth domain ready flag for UI warnings. */
export function vodexSupabaseAuthDomainReady(): boolean {
  return process.env.VODEX_SUPABASE_AUTH_DOMAIN_READY === "true";
}

/** Show "Built with Vodex" badge on public apps (default on). */
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
