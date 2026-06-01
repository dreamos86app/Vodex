import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import {
  CANONICAL_CREDIT_SOURCE,
  type CanonicalCreditBucket,
  type CanonicalCreditsPayload,
} from "@/lib/credits/canonical-credits";
import { useCreditsStore } from "@/lib/stores/credits-store";
import type { Profile } from "@/lib/supabase/types";

function bucketFromProfile(
  available: number,
  planAllowance: number,
  resetDate: string | null,
): CanonicalCreditBucket {
  return {
    available: Math.max(0, available),
    planAllowance,
    usedThisPeriod: Math.max(0, planAllowance - available),
    bonusActive: 0,
    bonusLabel: null,
    bonusExpiresAt: null,
    resetDate,
    reserved: 0,
    source: CANONICAL_CREDIT_SOURCE,
  };
}

/** Instant credits from profile row — background /api/credits refines balances. */
export function seedCreditsFromProfile(profile: Partial<Profile>): void {
  const planId = normalizePlanId(profile.plan_id ?? "free") as CanonicalCreditsPayload["planId"];
  const creditsLimit = (profile as { credits_limit?: number | null }).credits_limit;
  const buildAllowance =
    typeof creditsLimit === "number" && creditsLimit > 0
      ? creditsLimit
      : monthlyTokensForPlan(planId);
  const actionAllowance = monthlyActionCreditsForPlan(planId);
  const buildAvailable =
    typeof profile.credits_remaining === "number"
      ? profile.credits_remaining
      : buildAllowance;
  const resetDate =
    typeof profile.credits_reset_at === "string" ? profile.credits_reset_at : null;

  const payload: CanonicalCreditsPayload = {
    planId,
    build: bucketFromProfile(buildAvailable, buildAllowance, resetDate),
    action: bucketFromProfile(actionAllowance, actionAllowance, resetDate),
  };
  useCreditsStore.getState().applyProfileSeed(payload);
}
