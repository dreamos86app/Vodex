/** Client-safe auth route detection for preview navigation. */
export const PREVIEW_AUTH_SYSTEM_ROUTES = new Set([
  "/login",
  "/signup",
  "/sign-up",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth/forgot-password",
]);

export function isPreviewAuthSystemRoute(route: string): boolean {
  const r = route.toLowerCase().replace(/\/+$/, "") || "/";
  return PREVIEW_AUTH_SYSTEM_ROUTES.has(r);
}
