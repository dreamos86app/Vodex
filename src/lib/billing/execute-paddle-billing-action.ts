import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  billablePlanDefinition,
  billablePlanToPlanId,
  fromUpgradePolicyInterval,
  resolvePaddlePriceId,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";
import { validateCheckoutPlanInterval } from "@/lib/billing/paddle-billing";
import { buildPaddleCheckoutCustomData } from "@/lib/billing/paddle-checkout-custom-data";
import type { PaddleBillingContext } from "@/lib/billing/paddle-billing-context";
import { createPaddleCheckoutSession, updatePaddleSubscriptionPlan } from "@/lib/billing/paddle-api";
import type { PaddleBillingIntent } from "@/lib/billing/paddle-api";
import { logPlanChangeAttempt } from "@/lib/billing/plan-change-audit";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import {
  billingPeriodEndFromNow,
  fullPlanPriceUsd,
  UPGRADE_POLICY_COPY,
} from "@/lib/billing/upgrade-policy";
import { monthlyTokensForPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import {
  fetchSubscriptionByPaddleId,
  updateSubscriptionByPaddleId,
} from "@/lib/billing/paddle-subscription-legacy-store";
import {
  paddleBillingIntentForUnified,
  resolveUnifiedBillingAction,
  unifiedActionAllowsExecution,
  type UnifiedBillingResolution,
} from "@/lib/billing/unified-billing-action";
import type { PlanChangeSource } from "@/lib/billing/plan-change-router";
import {
  captureBillingSnapshot,
  createBillingAttempt,
  patchBillingAttempt,
} from "@/lib/billing/billing-attempt-trace";

export type ExecutePaddleBillingInput = {
  ctx: PaddleBillingContext;
  targetPlan: BillablePlanId;
  targetInterval: CatalogBillingInterval;
  source: PlanChangeSource;
  testMode?: boolean;
  successUrl?: string;
  cancelUrl?: string;
};

export type ExecutePaddleBillingResult =
  | {
      ok: true;
      mode: "paddle_checkout";
      url: string;
      transactionId?: string;
      resolution: UnifiedBillingResolution;
      customDataPreview: ReturnType<typeof buildPaddleCheckoutCustomData>;
      billingAttemptId: string;
    }
  | {
      ok: true;
      mode: "paddle_subscription_update";
      subscriptionId: string;
      message: string;
      resolution: UnifiedBillingResolution;
      preview: PlanChangePreview;
      billingAttemptId: string;
    }
  | {
      ok: true;
      mode: "scheduled_downgrade";
      pendingDowngradePlan: string;
      currentPeriodEnd: string | null;
      resolution: UnifiedBillingResolution;
      billingAttemptId: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
      httpStatus: number;
      resolution: UnifiedBillingResolution;
      usePortal?: boolean;
      requiresConfirmation?: boolean;
    };

export type PlanChangePreview = {
  currentPlan: { id: string; name: string };
  newPlan: {
    id: string;
    name: string;
    buildCredits: number;
    actionCredits: number;
  };
  amountDueTodayUsd: number;
  newRenewalDate: string;
  policyMessage: string;
};

function buildPreview(
  ctx: PaddleBillingContext,
  targetPlan: BillablePlanId,
  interval: CatalogBillingInterval,
): PlanChangePreview {
  const policyInterval = interval === "annual" ? "yearly" : "monthly";
  const targetStoragePlan = billablePlanToPlanId(targetPlan);
  return {
    currentPlan: {
      id: ctx.currentPlanId,
      name: PLAN_DISPLAY[ctx.currentPlanId]?.name ?? ctx.currentPlanId,
    },
    newPlan: {
      id: targetStoragePlan,
      name: billablePlanDefinition(targetPlan).label,
      buildCredits: monthlyTokensForPlan(targetStoragePlan),
      actionCredits: monthlyActionCreditsForPlan(targetStoragePlan),
    },
    amountDueTodayUsd: fullPlanPriceUsd(targetPlan, policyInterval) ?? 0,
    newRenewalDate: billingPeriodEndFromNow(policyInterval),
    policyMessage: UPGRADE_POLICY_COPY.upgradeSummary,
  };
}

export function resolvePaddleBillingAction(
  ctx: PaddleBillingContext,
  targetPlan: BillablePlanId,
  targetInterval: CatalogBillingInterval,
): UnifiedBillingResolution {
  return resolveUnifiedBillingAction({
    currentPlanId: ctx.currentPlanId,
    currentInterval: ctx.currentInterval,
    targetPlan,
    targetInterval,
    paddleSubscriptionId: ctx.paddleSubscriptionId,
  });
}

export async function executePaddleBillingAction(
  input: ExecutePaddleBillingInput,
): Promise<ExecutePaddleBillingResult> {
  const paddleStatus = getPaddleBillingStatus();
  if (!paddleStatus.configured) {
    const resolution = resolvePaddleBillingAction(
      input.ctx,
      input.targetPlan,
      input.targetInterval,
    );
    return {
      ok: false,
      code: "setup_required",
      error: paddleStatus.userMessage,
      httpStatus: 503,
      resolution,
    };
  }

  const validated = validateCheckoutPlanInterval(input.targetPlan, input.targetInterval);
  if (!validated.ok) {
    const resolution = resolvePaddleBillingAction(
      input.ctx,
      input.targetPlan,
      input.targetInterval,
    );
    return {
      ok: false,
      code: "invalid_price",
      error: validated.error,
      httpStatus: 400,
      resolution,
    };
  }

  const resolution = resolvePaddleBillingAction(
    input.ctx,
    validated.plan,
    validated.interval,
  );

  await logPlanChangeAttempt({
    userId: input.ctx.userId,
    previousPlan: normalizePlanId(input.ctx.currentPlanId),
    targetPlan: validated.plan,
    targetInterval: validated.interval,
    billingIntent: paddleBillingIntentForUnified(resolution),
    source: input.source,
    action: resolution.unifiedAction,
    blockedReason: unifiedActionAllowsExecution(resolution.unifiedAction)
      ? null
      : resolution.unifiedAction,
  });

  if (resolution.unifiedAction === "same_plan") {
    return {
      ok: false,
      code: "same_plan",
      error: resolution.description,
      httpStatus: 409,
      resolution,
    };
  }

  if (resolution.unifiedAction === "blocked") {
    return {
      ok: false,
      code: resolution.action === "portal" ? "use_portal" : "blocked",
      error: resolution.description,
      httpStatus: 409,
      resolution,
      usePortal: resolution.action === "portal",
    };
  }

  const before = await captureBillingSnapshot(input.ctx.userId);
  const billingAttemptId = await createBillingAttempt({
    userId: input.ctx.userId,
    targetPlan: validated.plan,
    endpointCalled: `/api/billing/paddle/action:${resolution.unifiedAction}`,
    resolvedAction: resolution.unifiedAction,
    before,
  });

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = getAppUrl();
  const successUrl =
    input.successUrl ??
    `${appUrl}/settings/billing?paddle=success&attemptId=${billingAttemptId}`;
  const cancelUrl =
    input.cancelUrl ?? `${appUrl}/settings/billing?paddle=canceled&attemptId=${billingAttemptId}`;
  const preview = buildPreview(input.ctx, validated.plan, validated.interval);
  const priceId = resolvePaddlePriceId(validated.plan, validated.interval)!;
  const billingIntent: PaddleBillingIntent = paddleBillingIntentForUnified(
    resolution,
  ) as PaddleBillingIntent;

  await patchBillingAttempt(billingAttemptId, {
    paddle_price_id: priceId,
    paddle_subscription_id: input.ctx.paddleSubscriptionId,
  });

  if (resolution.unifiedAction === "downgrade") {
    const subId = input.ctx.paddleSubscriptionId;
    if (!subId) {
      return {
        ok: false,
        code: "no_subscription",
        error: "No active subscription to downgrade.",
        httpStatus: 400,
        resolution,
      };
    }
    const admin = createSupabaseAdmin();
    const subRow = await fetchSubscriptionByPaddleId(admin, subId, "current_period_end");
    await updateSubscriptionByPaddleId(admin, subId, {
      pending_downgrade_plan: resolution.targetStoragePlanId,
    });
    return {
      ok: true,
      mode: "scheduled_downgrade",
      pendingDowngradePlan: resolution.targetStoragePlanId,
      currentPeriodEnd: subRow?.current_period_end ?? null,
      resolution,
      billingAttemptId,
    };
  }

  if (
    resolution.unifiedAction === "upgrade" ||
    resolution.unifiedAction === "switch_interval"
  ) {
    const subId = input.ctx.paddleSubscriptionId;
    if (!subId) {
      /* Fall through to checkout for paid users missing paddle_subscription_id in DB */
    } else {
      const catalogInterval = fromUpgradePolicyInterval(
        validated.interval === "annual" ? "yearly" : "monthly",
      );
      const updated = await updatePaddleSubscriptionPlan({
        subscriptionId: subId,
        planId: validated.plan,
        interval: catalogInterval,
        userId: input.ctx.userId,
        billingIntent:
          resolution.unifiedAction === "switch_interval" ? "interval_change" : "upgrade",
        billingAttemptId,
      });

      if (!updated.ok) {
        return {
          ok: false,
          code: updated.code ?? "api_error",
          error: updated.error,
          httpStatus: updated.code === "setup_required" ? 503 : 502,
          resolution,
        };
      }

      return {
        ok: true,
        mode: "paddle_subscription_update",
        subscriptionId: updated.subscriptionId,
        message:
          "Subscription updated in Paddle. Plan and credits refresh only after a verified webhook (transaction.completed / subscription.updated).",
        resolution,
        preview,
        billingAttemptId,
      };
    }
  }

  const customDataPreview = buildPaddleCheckoutCustomData({
    userId: input.ctx.userId,
    workspaceId: input.ctx.userId,
    planId: validated.plan,
    interval: validated.interval,
    priceId,
    source:
      input.source === "owner_test_checkout"
        ? "admin_test_checkout"
        : input.source === "billing_page"
          ? "settings"
          : "pricing",
    billingIntent,
    billingAttemptId,
    testMode: input.testMode,
  });

  const checkout = await createPaddleCheckoutSession({
    planId: validated.plan,
    interval: validated.interval,
    userId: input.ctx.userId,
    email: input.ctx.email,
    successUrl,
    cancelUrl,
    billingIntent,
    billingAttemptId,
    source:
      input.source === "owner_test_checkout"
        ? "admin_test_checkout"
        : input.source === "billing_page"
          ? "settings"
          : "pricing",
    testMode: input.testMode,
  });

  if (!checkout.ok) {
    return {
      ok: false,
      code: checkout.code ?? "api_error",
      error: checkout.error,
      httpStatus: checkout.code === "setup_required" ? 503 : 502,
      resolution,
    };
  }

  if (checkout.transactionId) {
    await patchBillingAttempt(billingAttemptId, {
      paddle_transaction_id: checkout.transactionId,
    });
  }

  return {
    ok: true,
    mode: "paddle_checkout",
    url: checkout.checkoutUrl,
    transactionId: checkout.transactionId,
    resolution,
    customDataPreview,
    billingAttemptId,
  };
}
