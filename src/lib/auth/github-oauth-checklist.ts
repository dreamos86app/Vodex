import { APP_URL, productionAuthCallbackUrl } from "@/lib/brand/brand-config";
import { DREAMOS_SUPABASE_URL } from "@/lib/supabase/project-ref";

/** Supabase Auth callback — register this in GitHub OAuth app settings. */
export function supabaseAuthCallbackUrl(): string {
  return `${DREAMOS_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/callback`;
}

/** App redirect after Supabase completes OAuth — configure in Supabase redirect URLs. */
export function vodexAuthCallbackUrl(): string {
  return productionAuthCallbackUrl();
}

export const GITHUB_OAUTH_APP_CHECKLIST = {
  homepageUrl: APP_URL,
  authorizationCallbackUrl: supabaseAuthCallbackUrl(),
  appRedirectAfterAuth: vodexAuthCallbackUrl(),
  deprecatedUrls: ["https://dreamos86.com", "https://dreamos86.com/auth/callback"],
} as const;
