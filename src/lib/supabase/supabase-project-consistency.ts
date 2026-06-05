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

  const resolvedRef = urlProjectRef ?? anonKeyProjectRef ?? serviceRoleProjectRef;

  if (!urlProjectRef && url) {
  } else if (!urlProjectRef && !resolvedRef) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is missing or not a *.supabase.co URL");
  } else if (resolvedRef && !isAllowedSupabaseProjectRef(resolvedRef)) {
    errors.push(`Supabase project ref "${resolvedRef}" is not in allowed project refs list`);
  }

  const refForKeyCheck = urlProjectRef ?? resolvedRef;
  if (anonKey && refForKeyCheck && anonKeyProjectRef && anonKeyProjectRef !== refForKeyCheck) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to project "${anonKeyProjectRef}" but URL points to "${urlProjectRef}"`,
    );
  }

  if (serviceKey && refForKeyCheck && serviceRoleProjectRef && serviceRoleProjectRef !== refForKeyCheck) {
    errors.push(
      `SUPABASE_SERVICE_ROLE_KEY belongs to project "${serviceRoleProjectRef}" but URL points to "${urlProjectRef}"`,
    );
  }

  const effectiveRef = urlProjectRef ?? resolvedRef;
  const customAuthDomain =
    url.includes("vodex.dev") || process.env.VODEX_SUPABASE_AUTH_DOMAIN_READY === "true";
  if (
    process.env.NODE_ENV === "production" &&
    effectiveRef &&
    effectiveRef !== PRODUCTION_CANONICAL_PROJECT_REF &&
    !(customAuthDomain && effectiveRef === PRODUCTION_CANONICAL_PROJECT_REF)
  ) {
    errors.push(
      `Production is using Supabase project "${effectiveRef}" but canonical is "${PRODUCTION_CANONICAL_PROJECT_REF}". ` +
        `Update Vercel env NEXT_PUBLIC_SUPABASE_URL and matching keys, or register Google OAuth callback for: ` +
        expectedGoogleOAuthRedirectUri(effectiveRef),
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
