import { injectPreviewPrehydrationLocationRewrite } from "@/lib/preview/inject-preview-prehydration-location-rewrite";
import { injectPreviewInnerWatchdog } from "@/lib/preview/inject-preview-inner-watchdog";
import { injectPreviewRouterShim } from "@/lib/preview/inject-preview-router-shim";
import { buildInternalPreviewHtmlUrl } from "@/lib/preview/internal-preview-url";
import { stripPreviewPlatformPathsFromText } from "@/lib/preview/strip-preview-platform-paths";
import { sanitizePreviewDocument } from "@/lib/preview/preview-html-sanitizer";
import { injectPreviewAuthCompat } from "@/lib/preview/inject-preview-auth-compat";
import { injectPreviewAuthGuard } from "@/lib/preview/inject-preview-auth-guard";
import { injectPreviewProjectContext } from "@/lib/preview/inject-preview-project-context";
import { injectPreviewBootAudit } from "@/lib/preview/inject-preview-boot-audit";
import { injectPreviewPostAuthEnforcer } from "@/lib/preview/inject-preview-post-auth-enforcer";
import { rewriteForeignSupabaseStorageUrls } from "@/lib/preview/preview-external-asset-rewrite";
import { stripIframeBlockingMetaFromHtml } from "@/lib/preview/preview-iframe-embed-headers";
import {
  buildPreviewRuntimeAssetUrl,
} from "@/lib/preview/preview-runtime-asset-url";

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
  assetVersion?: string | number | null,
): string {
  const assetUrl = (rel: string) =>
    buildPreviewRuntimeAssetUrl({
      projectId,
      artifactBuildId,
      relativePath: rel.replace(/^\//, ""),
      version: assetVersion,
    });

  let out = stripPreviewPlatformPathsFromText(html, projectId, { virtualRoute: routePath });

  out = out.replace(/<base\s[^>]*href=["'][^"']*["'][^>]*\/?>/gi, "");

  /** Rewrite legacy preview-assets API URLs to canonical preview-runtime asset paths. */
  out = out.replace(
    /\/api\/projects\/[^/"'\s>]+?\/preview-assets\/([^?"'\s>]+)(?:\?[^"'\s>]*)?/gi,
    (_, rel: string) => assetUrl(rel),
  );

  out = out.replace(/\s(src|href)=["'](\/assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p)}"`;
  });
  out = out.replace(/\s(src|href)=["'](\.\/assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p.replace(/^\.\//, ""))}"`;
  });
  out = out.replace(/\s(src|href)=["'](assets\/[^"']+)["']/gi, (_, attr, p) => {
    return ` ${attr}="${assetUrl(p)}"`;
  });
  out = out.replace(
    /<link([^>]*)\shref=["'](\/assets\/[^"']+)["']/gi,
    (_, attrs, p) => `<link${attrs} href="${assetUrl(p.slice(1))}"`,
  );

  out = rewriteAbsoluteVodexLinksInHtml(out);
  out = rewriteForeignSupabaseStorageUrls(out);
  /** Auth guard first in inject chain — executes last so href setter survives virtual-history patches. */
  out = injectPreviewAuthGuard(out);
  /** Router shim first, prehydration last — last prepend wins first execution in <head>. */
  out = injectPreviewRouterShim(out, routePath);
  out = injectPreviewPrehydrationLocationRewrite(out, routePath);
  out = injectPreviewInnerWatchdog(out);
  out = stripIframeBlockingMetaFromHtml(out);
  out = injectPreviewBootAudit(out);
  out = injectPreviewPostAuthEnforcer(out);
  /** Auth compat last — prepends first in <head> so it runs before module bundles. */
  out = injectPreviewAuthCompat(out);
  /** Last prepend = first execution — runtime base must exist before auth shims. */
  out = injectPreviewProjectContext(out, projectId, artifactBuildId);
  return sanitizePreviewDocument(out);
}

/** True when URL is safe for iframe embed (internal preview proxy only). */
export function isInternalPreviewProxyUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (url.startsWith("/preview-runtime/")) return true;
  if (url.startsWith("preview-runtime/")) return true;
  if (url.startsWith("/api/projects/") && url.includes("/preview-html")) return true;
  if (url.startsWith("api/projects/") && url.includes("/preview-html")) return true;
  if (url.startsWith("/api/projects/") && url.includes("/preview-assets")) return true;
  try {
    const u = new URL(url, "https://localhost");
    if (u.pathname.startsWith("/preview-runtime/")) return true;
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
