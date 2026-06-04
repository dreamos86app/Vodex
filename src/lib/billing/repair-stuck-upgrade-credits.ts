import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { sumExplicitActionGrants, sumExplicitBuildGrants } from "@/lib/credits/canonical-credits";
import { computeUpgradeCycleCredits } from "@/lib/billing/mid-cycle-upgrade-credits";
import type { PlanId } from "@/lib/supabase/types";

/**
 * One-time repair when a paid user has 0 build credits but an active billing period
 * (common after a broken upgrade path). Recomputes mid-cycle top-up from current plan only.
 */
export async function repairStuckUpgradeCreditsIfNeeded(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id, credits_remaining, credits_reset_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.plan_id) return false;
  const plan = normalizePlanId(profile.plan_id) as PlanId;
  if (plan === "free") return false;

  const remaining = profile.credits_remaining ?? 0;
  const allowance = monthlyTokensForPlan(plan);
  if (remaining > 0 || allowance <= 0) return false;

  const resetAt = profile.credits_reset_at;
  if (resetAt && new Date(resetAt).getTime() < Date.now()) return false;

  const explicitBuildBonus = await sumExplicitBuildGrants(admin, userId, resetAt);
  const explicitActionBonus = await sumExplicitActionGrants(admin, userId, resetAt);

  const { data: actionRow } = await admin
    .from("action_credit_balances" as never)
    .select("balance")
    .eq("owner_user_id" as never, userId)
    .is("project_id" as never, null)
    .maybeSingle();

  const actionBalance =
    actionRow && typeof (actionRow as { balance?: number }).balance === "number"
      ? (actionRow as { balance: number }).balance
      : monthlyActionCreditsForPlan(plan) + explicitActionBonus;

  const cycle = computeUpgradeCycleCredits({
    oldPlan: "free",
    newPlan: plan,
    buildRemainingBefore: 0,
    actionRemainingBefore: actionBalance,
    explicitBuildBonus,
    explicitActionBonus,
  });

  const buildCredits = Math.max(remaining, cycle.buildCredits);
  const actionCredits = Math.max(actionBalance, cycle.actionCredits);

  if (buildCredits <= 0 && actionCredits <= actionBalance) return false;

  await admin
    .from("profiles")
    .update({
      credits_remaining: buildCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await admin.from("action_credit_balances" as never).upsert(
    {
      owner_user_id: userId,
      project_id: null,
      balance: actionCredits,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "owner_user_id,project_id" },
  );

  return true;
}
