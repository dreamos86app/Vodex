import { injectPreviewRouterShim } from "@/lib/preview/inject-preview-router-shim";
import { buildInternalPreviewHtmlUrl } from "@/lib/preview/internal-preview-url";
import { stripPreviewPlatformPathsFromText } from "@/lib/preview/strip-preview-platform-paths";

export {
  assertInternalPreviewUrl,
  buildInternalPreviewHtmlUrl,
  normalizeInternalPreviewUrl,
  toPreviewIframeSrc,
  tryNormalizeInternalPreviewUrl,
} from "@/lib/preview/internal-preview-url";

/** Rewrite hardcoded vodex.dev /p/ links to in-app paths before the bundle boots. */
export function rewriteAbsoluteVodexLinksInHtml(html: string): string {
  let out = html;
  out = out.replace(
    /https?:\/\/(?:www\.)?vodex\.dev(\/[^"'\s>]*)/gi,
    (_, path: string) => path || "/",
  );
  out = out.replace(
    /https?:\/\/[^"'\s>]*\.vodex\.app(\/[^"'\s>]*)/gi,
    (_, path: string) => path || "/",
  );
  return out;
}

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

  let out = stripPreviewPlatformPathsFromText(html, projectId);

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

  out = rewriteAbsoluteVodexLinksInHtml(out);
  out = injectPreviewRouterShim(out, routePath);
  return out;
}

/** True when URL is safe for iframe embed (internal preview proxy only). */
export function isInternalPreviewProxyUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (url.startsWith("/api/projects/") && url.includes("/preview-html")) return true;
  if (url.startsWith("api/projects/") && url.includes("/preview-html")) return true;
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
  return buildInternalPreviewHtmlUrl({
    projectId,
    route,
    cacheBust,
    artifactBuildId,
  });
}
