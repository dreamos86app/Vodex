import {
  ALLOWED_SUPABASE_PROJECT_REFS,
  extractProjectRefFromSupabaseJwt,
  extractSupabaseProjectRefFromUrl,
  expectedGoogleOAuthRedirectUri,
  isAllowedSupabaseProjectRef,
  PRODUCTION_CANONICAL_PROJECT_REF,
} from "@/lib/supabase/supabase-project-config";

export type SupabaseProjectConsistencyResult = {
  ok: boolean;
  urlProjectRef: string | null;
  anonKeyProjectRef: string | null;
  serviceRoleProjectRef: string | null;
  productionCanonicalProjectRef: string;
  urlMatchesCanonical: boolean;
  anonKeyMatchesUrl: boolean;
  serviceRoleMatchesUrl: boolean;
  productionUsesCanonical: boolean;
  expectedGoogleRedirectUri: string | null;
  warnings: string[];
  errors: string[];
};

export function validateSupabaseProjectConsistency(): SupabaseProjectConsistencyResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    "";

  const urlProjectRef = extractSupabaseProjectRefFromUrl(url);
  const anonKeyProjectRef = extractProjectRefFromSupabaseJwt(anonKey);
  const serviceRoleProjectRef = extractProjectRefFromSupabaseJwt(serviceKey);

  const warnings: string[] = [];
  const errors: string[] = [];

  if (!urlProjectRef) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is missing or not a *.supabase.co URL");
  } else if (!isAllowedSupabaseProjectRef(urlProjectRef)) {
    errors.push(`Supabase URL project ref "${urlProjectRef}" is not in allowed project refs list`);
  }

  if (anonKey && urlProjectRef && anonKeyProjectRef && anonKeyProjectRef !== urlProjectRef) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to project "${anonKeyProjectRef}" but URL points to "${urlProjectRef}"`,
    );
  }

  if (serviceKey && urlProjectRef && serviceRoleProjectRef && serviceRoleProjectRef !== urlProjectRef) {
    errors.push(
      `SUPABASE_SERVICE_ROLE_KEY belongs to project "${serviceRoleProjectRef}" but URL points to "${urlProjectRef}"`,
    );
  }

  if (process.env.NODE_ENV === "production" && urlProjectRef && urlProjectRef !== PRODUCTION_CANONICAL_PROJECT_REF) {
    errors.push(
      `Production is using Supabase project "${urlProjectRef}" but canonical is "${PRODUCTION_CANONICAL_PROJECT_REF}". ` +
        `Update Vercel env NEXT_PUBLIC_SUPABASE_URL and matching keys, or register Google OAuth callback for: ` +
        expectedGoogleOAuthRedirectUri(urlProjectRef),
    );
  }

  if (
    urlProjectRef &&
    urlProjectRef !== PRODUCTION_CANONICAL_PROJECT_REF &&
    process.env.NODE_ENV !== "production"
  ) {
    warnings.push(
      `Dev env uses "${urlProjectRef}" — canonical production ref is "${PRODUCTION_CANONICAL_PROJECT_REF}"`,
    );
  }

  const urlMatchesCanonical = urlProjectRef === PRODUCTION_CANONICAL_PROJECT_REF;
  const anonKeyMatchesUrl = !anonKeyProjectRef || !urlProjectRef || anonKeyProjectRef === urlProjectRef;
  const serviceRoleMatchesUrl =
    !serviceRoleProjectRef || !urlProjectRef || serviceRoleProjectRef === urlProjectRef;
  const productionUsesCanonical =
    process.env.NODE_ENV !== "production" || urlProjectRef === PRODUCTION_CANONICAL_PROJECT_REF;

  return {
    ok: errors.length === 0,
    urlProjectRef,
    anonKeyProjectRef,
    serviceRoleProjectRef,
    productionCanonicalProjectRef: PRODUCTION_CANONICAL_PROJECT_REF,
    urlMatchesCanonical,
    anonKeyMatchesUrl,
    serviceRoleMatchesUrl,
    productionUsesCanonical,
    expectedGoogleRedirectUri: urlProjectRef ? expectedGoogleOAuthRedirectUri(urlProjectRef) : null,
    warnings,
    errors,
  };
}
