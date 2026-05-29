import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaddlePriceId } from "@/lib/billing/paddle-billing";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { sumExplicitBuildGrants } from "@/lib/credits/canonical-credits";
import { claimBillingEvent } from "@/lib/billing/billing-event-idempotency";
import type { BillingInterval } from "@/lib/billing/upgrade-policy";
import { billingPeriodEndFromNow } from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";

export type ApplyImmediatePlanUpgradeInput = {
  userId: string;
  oldPlan: string;
  newPlan: string;
  billingInterval: BillingInterval;
  paddleSubscriptionId?: string | null;
  paddleTransactionId?: string | null;
  effectiveAt?: string;
  /** Idempotent webhook / transaction id */
  idempotencyKey: string;
  source: string;
};

export type ApplyImmediatePlanUpgradeResult = {
  applied: boolean;
  buildCredits: number;
  actionCredits: number;
  periodEndIso: string;
};

/**
 * Canonical upgrade grant — full new allowance, no monthly leftover stacking.
 * Preserves explicit bonus/top-up grants from the ledger only.
 */
export async function applyImmediatePlanUpgrade(
  input: ApplyImmediatePlanUpgradeInput,
): Promise<ApplyImmediatePlanUpgradeResult> {
  const admin = createSupabaseAdmin();
  const newPlan = normalizePlanId(input.newPlan) as PlanId;
  const oldPlan = normalizePlanId(input.oldPlan) as PlanId;
  const effectiveAt = input.effectiveAt ?? new Date().toISOString();
  const periodEndIso = billingPeriodEndFromNow(input.billingInterval, new Date(effectiveAt));

  const buildAllowance = monthlyTokensForPlan(newPlan);
  const actionAllowance = monthlyActionCreditsForPlan(newPlan);
  const explicitBuildBonus = await sumExplicitBuildGrants(admin, input.userId);
  const buildCredits = buildAllowance + explicitBuildBonus;
  const actionCredits = actionAllowance;

  const claimed = await claimBillingEvent(admin, {
    eventId: input.idempotencyKey,
    userId: input.userId,
    eventType: "plan.upgrade.immediate",
    metadata: {
      old_plan: oldPlan,
      new_plan: newPlan,
      old_remaining_build: null,
      new_build_allowance: buildAllowance,
      new_action_allowance: actionAllowance,
      explicit_build_bonus_preserved: explicitBuildBonus,
      paddle_transaction_id: input.paddleTransactionId ?? null,
      paddle_subscription_id: input.paddleSubscriptionId ?? null,
      full_cycle_restart: true,
      billing_interval: input.billingInterval,
      effective_at: effectiveAt,
      source: input.source,
    },
  });

  if (!claimed) {
    return { applied: false, buildCredits, actionCredits, periodEndIso };
  }

  const { data: profileBefore } = await admin
    .from("profiles")
    .select("credits_remaining, plan_id")
    .eq("id", input.userId)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({
      plan_id: newPlan,
      credits_remaining: buildCredits,
      credits_reset_at: periodEndIso,
      ...(input.paddleSubscriptionId
        ? { stripe_subscription_id: input.paddleSubscriptionId }
        : {}),
    })
    .eq("id", input.userId);

  await admin.from("action_credit_balances" as never).upsert(
    {
      owner_user_id: input.userId,
      project_id: null,
      balance: actionCredits,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "owner_user_id,project_id" },
  );

  await admin.rpc("record_token_ledger", {
    p_user_id: input.userId,
    p_amount: -buildAllowance,
    p_source: "purchase",
    p_reason: `${input.source} — upgrade to ${newPlan} (full cycle restart)`,
    p_metadata: {
      plan_id: newPlan,
      old_plan: oldPlan,
      action_credits: actionCredits,
      full_cycle_restart: true,
      paddle_transaction_id: input.paddleTransactionId ?? null,
      explicit_build_bonus_preserved: explicitBuildBonus,
      prior_build_balance: profileBefore?.credits_remaining ?? null,
    },
  });

  if (input.paddleSubscriptionId) {
    const priceId =
      getPaddlePriceId(
        newPlan === "starter" || newPlan === "pro" || newPlan === "infinity" ? newPlan : "pro",
      ) ?? "paddle";
    await admin.from("subscriptions").upsert(
      {
        user_id: input.userId,
        stripe_subscription_id: input.paddleSubscriptionId,
        stripe_customer_id: "paddle",
        stripe_price_id: priceId,
        plan_id: newPlan,
        plan_interval: input.billingInterval === "yearly" ? "yearly" : "monthly",
        credits_per_period: buildAllowance,
        status: "active",
        current_period_start: effectiveAt,
        current_period_end: periodEndIso,
        pending_downgrade_plan: null,
      } as never,
      { onConflict: "stripe_subscription_id" },
    );
  }

  await admin.from("notifications").insert({
    user_id: input.userId,
    type: "credit",
    title: "Plan upgraded",
    body: `Your ${newPlan} plan is active. Build and Action Credits have been refreshed for a new billing cycle.`,
    action_url: "/settings/billing",
  });

  return { applied: true, buildCredits, actionCredits, periodEndIso };
}
