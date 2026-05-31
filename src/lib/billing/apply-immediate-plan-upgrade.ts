import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fromUpgradePolicyInterval,
  normalizeBillablePlanId,
  resolvePaddlePriceId,
} from "@/lib/billing/plan-billing-catalog";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { sumExplicitActionGrants, sumExplicitBuildGrants } from "@/lib/credits/canonical-credits";
import {
  finalizeBillingAttemptEntitlement,
  patchBillingAttempt,
  touchBillingAttemptWebhook,
} from "@/lib/billing/billing-attempt-trace";
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
  billingAttemptId?: string | null;
  /** Authoritative period end from Paddle when available */
  periodEndIso?: string | null;
  periodStartIso?: string | null;
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
  const effectiveAt = input.periodStartIso ?? input.effectiveAt ?? new Date().toISOString();
  const periodEndIso =
    input.periodEndIso?.trim() ||
    billingPeriodEndFromNow(input.billingInterval, new Date(effectiveAt));

  const buildAllowance = monthlyTokensForPlan(newPlan);
  const actionAllowance = monthlyActionCreditsForPlan(newPlan);
  const { data: profileRow } = await admin
    .from("profiles")
    .select("credits_reset_at")
    .eq("id", input.userId)
    .maybeSingle();
  const resetAt = profileRow?.credits_reset_at ?? null;
  const explicitBuildBonus = await sumExplicitBuildGrants(admin, input.userId, resetAt);
  const explicitActionBonus = await sumExplicitActionGrants(admin, input.userId, resetAt);
  const buildCredits = buildAllowance + explicitBuildBonus;
  const actionCredits = actionAllowance + explicitActionBonus;

  if (input.billingAttemptId) {
    await touchBillingAttemptWebhook(input.billingAttemptId, {
      entitlement_apply_started: true,
    });
  }

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
    await finalizeBillingAttemptEntitlement(input.billingAttemptId, {
      userId: input.userId,
      applied: false,
      failureMessage: "Duplicate entitlement event (already processed).",
    });
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
      explicit_action_bonus_preserved: explicitActionBonus,
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

  const { data: profileAfter } = await admin
    .from("profiles")
    .select("plan_id, credits_remaining")
    .eq("id", input.userId)
    .maybeSingle();

  const planOk = normalizePlanId(profileAfter?.plan_id ?? "free") === newPlan;
  const buildOk =
    typeof profileAfter?.credits_remaining === "number" &&
    profileAfter.credits_remaining >= buildCredits - 0.5;

  const applied = planOk && buildOk;

  await finalizeBillingAttemptEntitlement(input.billingAttemptId, {
    userId: input.userId,
    applied,
    failureCode: !planOk
      ? "plan_not_updated"
      : !buildOk
        ? "build_credits_not_updated"
        : null,
    failureMessage: !planOk
      ? `Profile plan is ${profileAfter?.plan_id ?? "unknown"}, expected ${newPlan}.`
      : !buildOk
        ? `Build credits are ${profileAfter?.credits_remaining ?? "unknown"}, expected ${buildCredits}.`
        : null,
  });

  if (input.billingAttemptId) {
    await patchBillingAttempt(input.billingAttemptId, {
      period_start_after: effectiveAt,
      period_end_after: periodEndIso,
    });
  }

  return { applied, buildCredits, actionCredits, periodEndIso };
}
