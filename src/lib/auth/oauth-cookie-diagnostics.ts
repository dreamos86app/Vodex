import { DREAMOS_REF_COOKIE } from "@/lib/auth/ref-cookie";
import { DREAMOS_RETURN_TO_COOKIE } from "@/lib/auth/oauth-prep";

export const OPTIONAL_OAUTH_STATE_COOKIES = [
  DREAMOS_REF_COOKIE,
  DREAMOS_RETURN_TO_COOKIE,
] as const;

export function isSupabasePkceVerifierCookie(name: string): boolean {
  return (
    name.includes("code-verifier") ||
    name.includes("code_verifier") ||
    (name.startsWith("sb-") && name.includes("auth") && name.includes("verifier"))
  );
}

export function listCookieNames(cookies: { name: string }[]): string[] {
  return [...new Set(cookies.map((c) => c.name))].sort();
}

export type OAuthCallbackCookieDiagnostics = {
  hasPkceVerifier: boolean;
  hasReferralCookie: boolean;
  hasReturnToCookie: boolean;
  supabaseAuthCookieNames: string[];
  optionalStateCookieNames: string[];
  allCookieNames: string[];
};

export function diagnoseOAuthCallbackCookies(
  cookies: { name: string }[],
): OAuthCallbackCookieDiagnostics {
  const allCookieNames = listCookieNames(cookies);
  return {
    hasPkceVerifier: allCookieNames.some(isSupabasePkceVerifierCookie),
    hasReferralCookie: allCookieNames.includes(DREAMOS_REF_COOKIE),
    hasReturnToCookie: allCookieNames.includes(DREAMOS_RETURN_TO_COOKIE),
    supabaseAuthCookieNames: allCookieNames.filter(
      (n) => n.startsWith("sb-") && n.includes("auth"),
    ),
    optionalStateCookieNames: allCookieNames.filter((n) =>
      (OPTIONAL_OAUTH_STATE_COOKIES as readonly string[]).includes(n),
    ),
    allCookieNames,
  };
}
