import { injectPreviewRouterShim } from "@/lib/preview/inject-preview-router-shim";

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

  return injectPreviewRouterShim(out, routePath);
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
