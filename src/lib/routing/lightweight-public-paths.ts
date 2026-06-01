/**
 * Routes that should not run heavy auth bootstrap, command palette, or app chrome.
 * Used by AppProvider and performance verification.
 */

const EXACT = new Set([
  "/",
  "/terms",
  "/privacy",
  "/refunds",
  "/contact",
  "/pricing",
  "/signup",
]);

const PREFIXES = ["/auth", "/invite", "/r/"];

export function isLightweightPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
