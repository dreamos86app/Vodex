import {
  expectedGoogleOAuthRedirectUri,
  isVodexSupabaseCustomDomainUrl,
  PRODUCTION_CANONICAL_PROJECT_REF,
  resolveSupabaseProjectRef,
} from "@/lib/supabase/supabase-project-config";
import { validateSupabaseProjectConsistency } from "@/lib/supabase/supabase-project-consistency";

export type SupabaseOAuthBlockReason = {
  code: "supabase_project_mismatch" | "supabase_env_invalid";
  message: string;
  configuredRef: string | null;
  canonicalRef: string;
  expectedGoogleRedirectUri: string | null;
  googleRedirectUriForCanonical: string;
};

/**
 * Returns a user-visible block reason when OAuth must not start (wrong Supabase project / mixed keys).
 * Production builds with the wrong NEXT_PUBLIC_SUPABASE_URL must fix Vercel env and redeploy.
 */
export function getSupabaseOAuthBlockReason(): SupabaseOAuthBlockReason | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const configuredRef = resolveSupabaseProjectRef();
  const canonicalRef = PRODUCTION_CANONICAL_PROJECT_REF;
  const googleRedirectUriForCanonical = expectedGoogleOAuthRedirectUri(canonicalRef);
  const customDomain = isVodexSupabaseCustomDomainUrl(url);

  if (!configuredRef) {
    return {
      code: "supabase_env_invalid",
      message: customDomain
        ? "Supabase custom domain is set but API keys are missing or invalid. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY matches your Supabase project and redeploy."
        : "Supabase is not configured correctly. Check NEXT_PUBLIC_SUPABASE_URL on the server and redeploy.",
      configuredRef: null,
      canonicalRef,
      expectedGoogleRedirectUri: customDomain ? `${url.replace(/\/$/, "")}/auth/v1/callback` : null,
      googleRedirectUriForCanonical,
    };
  }

  const consistency = validateSupabaseProjectConsistency();
  if (!consistency.ok) {
    const isWrongProject =
      configuredRef !== canonicalRef &&
      (process.env.NODE_ENV === "production" ||
        consistency.errors.some((e) => e.includes("Production is using")));

    if (isWrongProject || !consistency.anonKeyMatchesUrl) {
      return {
        code: "supabase_project_mismatch",
        message:
          configuredRef !== canonicalRef
            ? `Sign-in is misconfigured: this deployment uses Supabase project "${configuredRef}", but Vodex production requires "${canonicalRef}". Update Vercel Production environment variables (NEXT_PUBLIC_SUPABASE_URL, anon key, and service role from the same project), then redeploy. Google OAuth must register: ${googleRedirectUriForCanonical}`
            : `Sign-in is misconfigured: Supabase URL and API keys are from different projects. Use keys from ${configuredRef} for ${url} and redeploy.`,
        configuredRef,
        canonicalRef,
        expectedGoogleRedirectUri: expectedGoogleOAuthRedirectUri(configuredRef),
        googleRedirectUriForCanonical,
      };
    }
  }

  if (customDomain && configuredRef === canonicalRef) {
    return null;
  }

  if (process.env.NODE_ENV === "production" && configuredRef !== canonicalRef) {
    return {
      code: "supabase_project_mismatch",
      message:
        `Sign-in is misconfigured: production uses Supabase "${configuredRef}" but must use "${canonicalRef}". ` +
        `In Vercel → Settings → Environment Variables (Production), set NEXT_PUBLIC_SUPABASE_URL to https://${canonicalRef}.supabase.co ` +
        `and replace anon + service role keys from that project's dashboard, then redeploy. ` +
        `Google Authorized redirect URI must include: ${googleRedirectUriForCanonical}`,
      configuredRef,
      canonicalRef,
      expectedGoogleRedirectUri: expectedGoogleOAuthRedirectUri(configuredRef),
      googleRedirectUriForCanonical,
    };
  }

  return null;
}
