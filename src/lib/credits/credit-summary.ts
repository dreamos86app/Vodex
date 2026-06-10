import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanonicalCredits } from "@/lib/credits/canonical-credits";
import type { ProfileBillingRow } from "@/lib/supabase/load-profile-billing";

export type CreditSummary = Awaited<ReturnType<typeof loadCanonicalCredits>>["build"] & {
  available: number;
  planAllowance: number;
  planId: string;
};

/** Display credits with one decimal (e.g. 26.8 BC). */
export function formatCreditAmount(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** @deprecated Use loadCanonicalCredits directly. */
export async function loadCreditSummary(
  _supabase: SupabaseClient,
  userId: string,
  profile: ProfileBillingRow,
): Promise<CreditSummary & { bonusCredits: number; purchasedCredits: number; usedThisPeriod: number; reserved: number; resetAt: string | null; isTestOrGrantAccount: boolean; staleSeedCorrected: boolean }> {
  const canonical = await loadCanonicalCredits({
    userId,
    planId: profile.plan_id,
    email: profile.email,
    creditsResetAt: profile.credits_reset_at,
    buildAvailable: profile.credits_remaining,
  });

  return {
    ...canonical.build,
    available: canonical.build.available,
    planAllowance: canonical.build.planAllowance,
    planId: canonical.planId,
    bonusCredits: canonical.build.bonusActive,
    purchasedCredits: 0,
    usedThisPeriod: canonical.build.usedThisPeriod,
    reserved: canonical.build.reserved,
    resetAt: canonical.build.resetDate,
    isTestOrGrantAccount: canonical.build.bonusActive > 0,
    staleSeedCorrected: false,
  };
}
