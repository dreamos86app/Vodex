import "server-only";

/**
 * Single OAuth callback for all published apps — configure once in Supabase/Google.
 */
export function getCentralOAuthOrigin(): string {
  const authDomain = process.env.VODEX_AUTH_DOMAIN?.trim();
  if (authDomain) {
    return authDomain.startsWith("http") ? authDomain.replace(/\/$/, "") : `https://${authDomain}`;
  }
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return app.replace(/\/$/, "");
  return "https://vodex.dev";
}

export function getCentralOAuthCallbackUrl(): string {
  return `${getCentralOAuthOrigin()}/auth/callback`;
}

export function useCentralPublishedOAuth(): boolean {
  return process.env.VODEX_CENTRAL_OAUTH_CALLBACK !== "false";
}
