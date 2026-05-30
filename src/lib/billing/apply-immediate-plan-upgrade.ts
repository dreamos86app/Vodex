import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fromUpgradePolicyInterval,
  normalizeBillablePlanId,
  resolvePaddlePriceId,
} from "@/lib/billing/plan-billing-catalog";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { sumExplicitBuildGrants } from "@/lib/credits/canonical-credits";
import { claimBillingEvent } from "@/lib/billing/billing-event-idempotency";
import { logPaddleEntitlementAudit } from "@/lib/billing/paddle-entitlement-audit";
import {
  updateProfilePaddleBilling,
  upsertPaddleSubscriptionMirror,
} from "@/lib/billing/paddle-subscription-legacy-store";
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
  paddlePriceId?: string | null;
  paddleCustomerId?: string | null;
  paddleEventId?: string | null;
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

  await updateProfilePaddleBilling(admin, input.userId, {
    customerId: input.paddleCustomerId,
    subscriptionId: input.paddleSubscriptionId,
    priceId: input.paddlePriceId,
    planId: newPlan,
    subscriptionStatus: "active",
    creditsRemaining: buildCredits,
    creditsResetAt: periodEndIso,
  });

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
    const billable = normalizeBillablePlanId(newPlan);
    const catalogInterval = fromUpgradePolicyInterval(
      input.billingInterval === "yearly" ? "yearly" : "monthly",
    );
    const priceId =
      (billable ? resolvePaddlePriceId(billable, catalogInterval) : null) ?? "paddle";
    await upsertPaddleSubscriptionMirror(admin, {
      userId: input.userId,
      subscriptionId: input.paddleSubscriptionId,
      customerId: input.paddleCustomerId,
      priceId: priceId.startsWith("pri_") ? priceId : null,
      planId: newPlan,
      planInterval: input.billingInterval === "yearly" ? "yearly" : "monthly",
      creditsPerPeriod: buildAllowance,
      status: "active",
      periodStart: effectiveAt,
      periodEnd: periodEndIso,
      pendingDowngradePlan: null,
    });
  }

  await logPaddleEntitlementAudit({
    userId: input.userId,
    previousPlan: oldPlan,
    newPlan,
    buildCreditsBefore: profileBefore?.credits_remaining ?? null,
    buildCreditsAfter: buildCredits,
    actionCreditsAfter: actionCredits,
    paddleEventId: input.paddleEventId ?? null,
    paddleTransactionId: input.paddleTransactionId ?? null,
    paddleSubscriptionId: input.paddleSubscriptionId ?? null,
    paddlePriceId: input.paddlePriceId ?? null,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
  });

  await admin.from("notifications").insert({
    user_id: input.userId,
    type: "credit",
    title: "Plan upgraded",
    body: `Your ${newPlan} plan is active. Build and Action Credits have been refreshed for a new billing cycle.`,
    action_url: "/settings/billing",
  });

  return { applied: true, buildCredits, actionCredits, periodEndIso };
}
