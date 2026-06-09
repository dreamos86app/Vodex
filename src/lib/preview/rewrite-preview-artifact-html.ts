import { injectPreviewNavigationGuard } from "@/lib/preview/inject-preview-navigation-guard";
import { injectPreviewRouterShim } from "@/lib/preview/inject-preview-router-shim";
import { injectPreviewRouteListener } from "@/lib/preview/inject-preview-route-listener";

/**
 * Rewrites built SPA index.html asset URLs to the authenticated preview-assets API.
 */
export function rewritePreviewArtifactHtml(
  html: string,
  projectId: string,
  artifactBuildId: string,
  routePath = "/",
): string {
  const base = `/api/projects/${encodeURIComponent(projectId)}/preview-assets`;
  const q = `build=${encodeURIComponent(artifactBuildId)}`;

  const assetUrl = (rel: string) => {
    const clean = rel.replace(/^\//, "");
    return `${base}/${clean}?${q}`;
  };

  let out = html;

  if (!/<base\s/i.test(out)) {
    const baseTag = `<base href="${base}/?${q}" />`;
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
    } else {
      out = baseTag + out;
    }
  }

  out = out.replace(/\s(src|href)=["'](\/assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p)}"`;
  });
  out = out.replace(/\s(src|href)=["'](\.\/assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p.replace(/^\.\//, ""))}"`;
  });
  out = out.replace(/\s(src|href)=["'](assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p)}"`;
  });

  out = injectPreviewNavigationGuard(out);
  out = injectPreviewRouterShim(out, routePath);
  return injectPreviewRouteListener(out);
}

/** True when URL is safe for iframe embed (internal preview proxy only). */
export function isInternalPreviewProxyUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (url.startsWith("/api/projects/") && url.includes("/preview-html")) return true;
  try {
    const u = new URL(url, "https://localhost");
    return u.pathname.includes("/preview-html") || u.pathname.includes("/preview-assets");
  } catch {
    return false;
  }
}

/** Block raw vodex.dev /p/ URLs — they refuse iframe embed. */
export function isBlockedRawAppPreviewUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (isInternalPreviewProxyUrl(url)) return false;
  return /vodex\.dev\/p\//i.test(url) || /vodex\.app\/p\//i.test(url) || /^https?:\/\/[^/]*vodex\.dev\//i.test(url);
}

export function previewFrameUrlWithRoute(
  projectId: string,
  cacheBust: string | number | undefined,
  route?: string | null,
  artifactBuildId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("format", "frame");
  if (cacheBust != null && cacheBust !== "") params.set("v", String(cacheBust));
  if (artifactBuildId) params.set("artifact", artifactBuildId);
  if (route && route !== "/") params.set("route", route.startsWith("/") ? route : `/${route}`);
  return `/api/projects/${encodeURIComponent(projectId)}/preview-html?${params.toString()}`;
}
