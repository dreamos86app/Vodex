import { injectPreviewRouterShim } from "@/lib/preview/inject-preview-router-shim";

/**
 * Rewrites built SPA index.html asset URLs to the public published-assets API.
 */
export function rewritePublishedArtifactHtml(
  html: string,
  slug: string,
  routePath = "/",
): string {
  const base = `/api/public/${encodeURIComponent(slug)}/assets`;
  const assetUrl = (rel: string) => {
    const clean = rel.replace(/^\//, "");
    return `${base}/${clean}`;
  };

  let out = html;

  const runtimeStyle =
    '<style id="vodex-published-runtime">html,body{min-height:100%;margin:0}#root,#app,.app-root{min-height:100vh}</style>';
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${runtimeStyle}`);
  } else {
    out = runtimeStyle + out;
  }

  if (!/<base\s/i.test(out)) {
    const baseTag = `<base href="${base}/" />`;
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
