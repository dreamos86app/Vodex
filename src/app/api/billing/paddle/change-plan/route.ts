import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createPaddleCheckoutSession,
  updatePaddleSubscriptionPlan,
} from "@/lib/billing/paddle-api";
import { fromUpgradePolicyInterval } from "@/lib/billing/plan-billing-catalog";
import { getPaddleBillingStatus, validateCheckoutPlanInterval } from "@/lib/billing/paddle-billing";
import {
  billingPeriodEndFromNow,
  fullPlanPriceUsd,
  isPlanDowngrade,
  isPlanUpgrade,
  UPGRADE_POLICY_COPY,
} from "@/lib/billing/upgrade-policy";
import { billablePlanDefinition, billablePlanToPlanId } from "@/lib/billing/plan-billing-catalog";
import { monthlyTokensForPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";
import {
  fetchSubscriptionByPaddleId,
  updateSubscriptionByPaddleId,
} from "@/lib/billing/paddle-subscription-legacy-store";

const schema = z.object({
  plan: z.string(),
  interval: z.enum(["monthly", "annual"]),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  const status = getPaddleBillingStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: status.userMessage, code: "setup_required", paddle: status },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm plan change before continuing." }, { status: 400 });
  }

  const validatedPlan = validateCheckoutPlanInterval(parsed.data.plan, parsed.data.interval);
  if (!validatedPlan.ok) {
    return NextResponse.json({ error: validatedPlan.error, code: "invalid_price" }, { status: 400 });
  }
  const targetPlan = validatedPlan.plan;
  const targetStoragePlan = billablePlanToPlanId(targetPlan);
  const policyInterval = parsed.data.interval === "annual" ? "yearly" : "monthly";
  const catalogInterval = fromUpgradePolicyInterval(policyInterval);

  const { data: profile } = await supabase
    .from("profiles")
    .select(`plan_id, ${PROFILE_PADDLE_BILLING_SELECT}`)
    .eq("id", user.id)
    .single();

  const currentPlan = normalizePlanId(profile?.plan_id ?? "free");
  const existingSubId = readProfilePaddleSubscriptionId(profile ?? undefined);

  if (isPlanDowngrade(currentPlan, targetStoragePlan)) {
    if (!existingSubId) {
      return NextResponse.json({ error: "No active subscription to downgrade" }, { status: 400 });
    }
    const subRow = await fetchSubscriptionByPaddleId(
      supabase,
      existingSubId,
      "current_period_end",
    );

    await updateSubscriptionByPaddleId(supabase, existingSubId, {
      pending_downgrade_plan: targetStoragePlan,
    });

    return NextResponse.json({
      mode: "scheduled_downgrade",
      pendingDowngradePlan: targetStoragePlan,
      currentPeriodEnd: subRow?.current_period_end ?? null,
      policyMessage: UPGRADE_POLICY_COPY.downgradeSummary,
      billingProvider: "paddle",
    });
  }

  const amountDueTodayUsd = fullPlanPriceUsd(targetPlan, policyInterval);
  const preview = {
    currentPlan: { id: currentPlan, name: PLAN_DISPLAY[currentPlan].name },
    newPlan: {
      id: targetStoragePlan,
      name: billablePlanDefinition(targetPlan).label,
      buildCredits: monthlyTokensForPlan(targetStoragePlan),
      actionCredits: monthlyActionCreditsForPlan(targetStoragePlan),
    },
    amountDueTodayUsd,
    newRenewalDate: billingPeriodEndFromNow(policyInterval),
    policyMessage: UPGRADE_POLICY_COPY.upgradeSummary,
  };

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = getAppUrl();
  const email = user.email ?? "";
  if (!email) {
    return NextResponse.json({ error: "Account email required" }, { status: 400 });
  }

  const isUpgrade = isPlanUpgrade(currentPlan, targetStoragePlan);
  const isIntervalChange = currentPlan === targetStoragePlan;

  if (existingSubId && (isUpgrade || isIntervalChange)) {
    const updated = await updatePaddleSubscriptionPlan({
      subscriptionId: existingSubId,
      planId: targetPlan,
      interval: catalogInterval,
      userId: user.id,
      billingIntent: isIntervalChange ? "interval_change" : "upgrade",
    });

    if (!updated.ok) {
      return NextResponse.json(
        { error: updated.error, code: updated.code, preview },
        { status: updated.code === "setup_required" ? 503 : 502 },
      );
    }

    return NextResponse.json({
      mode: "paddle_subscription_update",
      subscriptionId: updated.subscriptionId,
      preview,
      message: "Credits refresh after Paddle confirms payment (webhook).",
      billingProvider: "paddle",
    });
  }

  const checkout = await createPaddleCheckoutSession({
    planId: targetPlan,
    interval: catalogInterval,
    userId: user.id,
    email,
    successUrl: `${appUrl}/settings/billing?paddle=success`,
    cancelUrl: `${appUrl}/settings/billing?paddle=canceled`,
    billingIntent: "new_subscription",
  });

  if (!checkout.ok) {
    return NextResponse.json(
      { error: checkout.error, code: checkout.code, preview },
      { status: checkout.code === "setup_required" ? 503 : 502 },
    );
  }

  return NextResponse.json({
    mode: "paddle_checkout",
    url: checkout.checkoutUrl,
    transactionId: checkout.transactionId,
    preview,
    billingProvider: "paddle",
  });
}
