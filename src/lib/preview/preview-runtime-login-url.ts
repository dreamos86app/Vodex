/** Normalize preview-runtime mount URL to Vodex login path (zip imports). */

const AUTH_PATH_RE = /^\/(login|signup|sign-up|register|forgot|reset|auth)(\/|$)/i;

export function isPreviewRuntimeAuthPath(pathname: string): boolean {
  const runtimeMatch = pathname.match(/^\/preview-runtime\/[^/]+\/[^/]+(\/.*)?$/);
  if (!runtimeMatch) return false;
  const tail = (runtimeMatch[1] ?? "").replace(/\/+$/, "") || "/";
  return AUTH_PATH_RE.test(tail);
}

export function withPreviewRuntimeLoginPath(src: string): string {
  try {
    const u = new URL(src, "https://vodex.dev");
    const path = u.pathname.replace(/\/+$/, "");
    const runtimeMatch = path.match(/^(\/preview-runtime\/[^/]+\/[^/]+)(?:\/.*)?$/);
    if (!runtimeMatch) return src;
    const base = runtimeMatch[1];
    const tail = path.slice(base.length);
    if (AUTH_PATH_RE.test(tail)) return src;
    u.pathname = `${base}/login`;
    return u.href;
  } catch {
    return src.replace(/\/?$/, "") + "/login";
  }
}
