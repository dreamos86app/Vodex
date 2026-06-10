import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanonicalCredits } from "@/lib/credits/canonical-credits";
import type { ProfileBillingRow } from "@/lib/supabase/load-profile-billing";

export type CreditSummary = Awaited<ReturnType<typeof loadCanonicalCredits>>["build"] & {
  available: number;
  planAllowance: number;
  planId: string;
};

/** Display credits — show decimals only when fractional part is non-zero (e.g. 218 vs 26.8). */
export function formatCreditAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: isWhole ? 0 : 1,
    maximumFractionDigits: isWhole ? 0 : 1,
  });
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
