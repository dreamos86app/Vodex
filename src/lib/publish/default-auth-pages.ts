import "server-only";

export type AppAuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  microsoft_enabled?: boolean;
  facebook_enabled?: boolean;
  oauth_mode?: "vodex_managed" | "custom";
};

export const AUTH_SYSTEM_ROUTES = new Set([
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

export function isAuthSystemRoute(route: string): boolean {
  const r = route.toLowerCase().replace(/\/+$/, "") || "/";
  return AUTH_SYSTEM_ROUTES.has(r);
}

export function authEnabled(settings: AppAuthSettings | null): boolean {
  if (!settings) return false;
  return Boolean(
    settings.email_password_enabled ||
      settings.google_enabled ||
      settings.github_enabled ||
      settings.apple_enabled ||
      settings.microsoft_enabled ||
      settings.facebook_enabled,
  );
}
