import { paddleEnvironment } from "@/lib/billing/paddle-billing";
import { validateSupabaseProjectConsistency } from "@/lib/supabase/supabase-project-consistency";
import { PRODUCTION_CANONICAL_PROJECT_REF } from "@/lib/supabase/supabase-project-config";
import { getAppUrl } from "@/lib/app-url";

export type PaddleCheckoutTestingContext = {
  appOrigin: string;
  webhookUrl: string;
  supabaseProjectRef: string | null;
  productionCanonicalRef: string;
  supabaseMatchesProduction: boolean;
  localDevWithProductionPaddle: boolean;
  sharedSupabaseMessage: string | null;
  supabaseMismatchError: string | null;
};

export function buildPaddleCheckoutTestingContext(appUrl: string): PaddleCheckoutTestingContext {
  const consistency = validateSupabaseProjectConsistency();
  const ref = consistency.urlProjectRef;
  const localDevWithProductionPaddle =
    process.env.NODE_ENV === "development" && paddleEnvironment() === "production";
  const supabaseMatchesProduction = ref === PRODUCTION_CANONICAL_PROJECT_REF;

  let sharedSupabaseMessage: string | null = null;
  if (localDevWithProductionPaddle && supabaseMatchesProduction) {
    sharedSupabaseMessage =
      "Local UI will update after the production webhook writes to the shared Supabase project.";
  }

  let supabaseMismatchError: string | null = null;
  if (localDevWithProductionPaddle && ref && !supabaseMatchesProduction) {
    supabaseMismatchError =
      `Local Supabase project (${ref}) differs from production (${PRODUCTION_CANONICAL_PROJECT_REF}). ` +
      "Production Paddle webhooks will not update this local database — align NEXT_PUBLIC_SUPABASE_URL and keys.";
  }

  return {
    appOrigin: getAppUrl(),
    webhookUrl: `${appUrl.replace(/\/$/, "")}/api/webhooks/paddle`,
    supabaseProjectRef: ref,
    productionCanonicalRef: PRODUCTION_CANONICAL_PROJECT_REF,
    supabaseMatchesProduction,
    localDevWithProductionPaddle,
    sharedSupabaseMessage,
    supabaseMismatchError,
  };
}

export function assertPaddleCheckoutSupabaseConsistency():
  | { ok: true }
  | { ok: false; error: string } {
  const ctx = buildPaddleCheckoutTestingContext(getAppUrl());
  if (ctx.supabaseMismatchError) {
    return { ok: false, error: ctx.supabaseMismatchError };
  }
  return { ok: true };
}
