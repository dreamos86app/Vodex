import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanId } from "@/lib/billing/plans";
import { computeUpgradeCycleCredits } from "@/lib/billing/mid-cycle-upgrade-credits";
import { sumExplicitActionGrants, sumExplicitBuildGrants } from "@/lib/credits/canonical-credits";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { monthlyTokensForPlan } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";

export type ApplyAdminPlanChangeResult = {
  ok: boolean;
  error?: string;
  buildCredits?: number;
  actionCredits?: number;
  plan?: string;
};

/**
 * Admin / self-service plan change with mid-cycle usage preservation (same rules as Paddle upgrade).
 */
export async function applyAdminPlanChange(input: {
  userId: string;
  newPlan: string;
  reason: string;
  adminId: string;
}): Promise<ApplyAdminPlanChangeResult> {
  const admin = createSupabaseAdmin();
  if (!admin) return { ok: false, error: "service_unavailable" };

  const newPlan = normalizePlanId(input.newPlan) as PlanId;
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id, credits_remaining, credits_reset_at")
    .eq("id", input.userId)
    .maybeSingle();

  if (!profile) return { ok: false, error: "user_not_found" };

  const oldPlan = normalizePlanId(profile.plan_id ?? "free") as PlanId;
  const resetAt = profile.credits_reset_at ?? null;
  const explicitBuildBonus = await sumExplicitBuildGrants(admin, input.userId, resetAt);
  const explicitActionBonus = await sumExplicitActionGrants(admin, input.userId, resetAt);

  const { data: actionRow } = await admin
    .from("action_credit_balances" as never)
    .select("balance")
    .eq("owner_user_id" as never, input.userId)
    .is("project_id" as never, null)
    .maybeSingle();
  const actionBalance =
    actionRow && typeof (actionRow as { balance?: number }).balance === "number"
      ? (actionRow as { balance: number }).balance
      : monthlyActionCreditsForPlan(oldPlan) + explicitActionBonus;

  const buildRemainingBefore = Math.max(0, profile.credits_remaining ?? 0);
  const cycle = computeUpgradeCycleCredits({
    oldPlan,
    newPlan,
    buildRemainingBefore,
    actionRemainingBefore: actionBalance,
    explicitBuildBonus,
    explicitActionBonus,
  });

  const buildCredits = cycle.buildCredits;
  const actionCredits = cycle.actionCredits;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      plan_id: newPlan,
      credits_remaining: buildCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (profileErr) return { ok: false, error: profileErr.message };

  await admin.from("action_credit_balances" as never).upsert(
    {
      owner_user_id: input.userId,
      project_id: null,
      balance: actionCredits,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "owner_user_id,project_id" },
  );

  const opId = `plan_upgrade_delta:${input.userId}:${Date.now()}`;
  await admin.from("token_ledger").insert({
    user_id: input.userId,
    amount: 0,
    reason: input.reason,
    source: "plan_upgrade_delta",
    admin_user_id: input.adminId,
    metadata: {
      idempotency_key: opId,
      admin_id: input.adminId,
      old_plan: oldPlan,
      new_plan: newPlan,
      old_allowance_build: monthlyTokensForPlan(oldPlan) + explicitBuildBonus,
      new_allowance_build: monthlyTokensForPlan(newPlan) + explicitBuildBonus,
      old_allowance_action: monthlyActionCreditsForPlan(oldPlan) + explicitActionBonus,
      new_allowance_action: monthlyActionCreditsForPlan(newPlan) + explicitActionBonus,
      previous_remaining_build: profile.credits_remaining,
      previous_remaining_action: actionBalance,
      new_remaining_build: buildCredits,
      new_remaining_action: actionCredits,
      mid_cycle_preserve: cycle.midCyclePreserveUsage,
    },
  });

  return { ok: true, buildCredits, actionCredits, plan: newPlan };
}
