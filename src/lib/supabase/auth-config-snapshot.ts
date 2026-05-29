import { getCanonicalOAuthRedirectTo } from "@/lib/auth/oauth-redirect";
import { resolveAppOrigin } from "@/lib/url/app-origin";
import {
  extractProjectRefFromSupabaseJwt,
  extractSupabaseProjectRefFromUrl,
  expectedGoogleOAuthRedirectUri,
  PRODUCTION_CANONICAL_PROJECT_REF,
} from "@/lib/supabase/supabase-project-config";
import { validateSupabaseProjectConsistency } from "@/lib/supabase/supabase-project-consistency";

export type AuthConfigSnapshot = {
  appOrigin: string;
  supabaseUrlHost: string | null;
  supabaseProjectRef: string | null;
  anonKeyProjectRef: string | null;
  serviceRoleProjectRef: string | null;
  productionCanonicalProjectRef: string;
  canonicalOAuthCallback: string;
  expectedGoogleRedirectUri: string | null;
  environment: string;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  googleClientConfigured: boolean | null;
  githubClientConfigured: boolean | null;
  consistencyOk: boolean;
  consistencyErrors: string[];
  consistencyWarnings: string[];
};

export async function buildAuthConfigSnapshot(requestUrl?: string): Promise<AuthConfigSnapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    "";

  const consistency = validateSupabaseProjectConsistency();
  const urlRef = extractSupabaseProjectRefFromUrl(url);

  let googleClientConfigured: boolean | null = null;
  let githubClientConfigured: boolean | null = null;

  if (url && anon) {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { external?: Record<string, unknown> };
        const keys = Object.keys(body.external ?? {});
        googleClientConfigured = keys.some((k) => k.toLowerCase() === "google");
        githubClientConfigured = keys.some((k) => k.toLowerCase() === "github");
      }
    } catch {
      googleClientConfigured = null;
      githubClientConfigured = null;
    }
  }

  return {
    appOrigin: resolveAppOrigin(requestUrl),
    supabaseUrlHost: url ? new URL(url).hostname : null,
    supabaseProjectRef: urlRef,
    anonKeyProjectRef: extractProjectRefFromSupabaseJwt(anon),
    serviceRoleProjectRef: extractProjectRefFromSupabaseJwt(service),
    productionCanonicalProjectRef: PRODUCTION_CANONICAL_PROJECT_REF,
    canonicalOAuthCallback: getCanonicalOAuthRedirectTo(requestUrl),
    expectedGoogleRedirectUri: urlRef ? expectedGoogleOAuthRedirectUri(urlRef) : null,
    environment: process.env.NODE_ENV ?? "unknown",
    hasAnonKey: Boolean(anon),
    hasServiceRoleKey: Boolean(service),
    googleClientConfigured,
    githubClientConfigured,
    consistencyOk: consistency.ok,
    consistencyErrors: consistency.errors,
    consistencyWarnings: consistency.warnings,
  };
}
