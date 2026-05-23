import { PLATFORM_BASE_DOMAIN, wildcardSubdomainEnabled } from "@/lib/publish/publish-config";

export function buildPublicUrl(slug: string): { url: string; mode: "subdomain" | "path" } {
  const safe = slug.trim().toLowerCase();
  if (wildcardSubdomainEnabled()) {
    return { url: `https://${safe}.${PLATFORM_BASE_DOMAIN}`, mode: "subdomain" };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `https://${PLATFORM_BASE_DOMAIN}`;
  return { url: `${base}/p/${safe}`, mode: "path" };
}
