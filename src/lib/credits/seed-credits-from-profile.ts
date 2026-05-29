import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import type { CanonicalCreditsPayload } from "@/lib/credits/canonical-credits";
import { clampProfileSeedAvailable } from "@/lib/credits/credit-balance-display";
import { useCreditsStore } from "@/lib/stores/credits-store";
import type { Profile } from "@/lib/supabase/types";

/** Instant plan hint from profile — never marks credits confirmed or shows inflated balances. */
export function seedCreditsFromProfile(profile: Partial<Profile>): void {
  const planId = normalizePlanId(profile.plan_id ?? "free") as CanonicalCreditsPayload["planId"];
  const buildAllowance = monthlyTokensForPlan(planId);
  const actionAllowance = monthlyActionCreditsForPlan(planId);
  const rawBuild =
    typeof profile.credits_remaining === "number" ? profile.credits_remaining : buildAllowance;
  const { available: buildAvailable, impliedBonus } = clampProfileSeedAvailable(
    rawBuild,
    buildAllowance,
  );

  useCreditsStore.getState().applyProfileHint({
    planId,
    build: {
      available: buildAvailable,
      planAllowance: buildAllowance,
      usedThisPeriod: Math.max(0, buildAllowance - buildAvailable),
      bonusActive: impliedBonus,
      bonusLabel: impliedBonus > 0 ? "Bonus" : null,
      bonusExpiresAt: null,
      resetDate: profile.credits_reset_at ?? null,
      reserved: 0,
      source: "canonical_balance",
    },
    action: {
      available: actionAllowance,
      planAllowance: actionAllowance,
      usedThisPeriod: 0,
      bonusActive: 0,
      bonusLabel: null,
      bonusExpiresAt: null,
      resetDate: profile.credits_reset_at ?? null,
      reserved: 0,
      source: "canonical_balance",
    },
  });
}
