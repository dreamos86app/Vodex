import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createPaddleCheckoutSession,
  updatePaddleSubscriptionPlan,
} from "@/lib/billing/paddle-api";
import { getPaddleBillingStatus, type PaddleCheckoutPlan } from "@/lib/billing/paddle-billing";
import {
  billingPeriodEndFromNow,
  fullPlanPriceUsd,
  isPlanUpgrade,
  UPGRADE_POLICY_COPY,
} from "@/lib/billing/upgrade-policy";
import { monthlyTokensForPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";

const schema = z.object({
  planId: z.enum(["starter", "pro", "infinity"]),
  interval: z.enum(["monthly", "yearly"]).optional().default("monthly"),
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
    return NextResponse.json({ error: "Confirm upgrade details before continuing." }, { status: 400 });
  }

  const targetPlan = parsed.data.planId as PaddleCheckoutPlan;
  const interval = parsed.data.interval;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const currentPlan = normalizePlanId(profile?.plan_id ?? "free");
  if (!isPlanUpgrade(currentPlan, targetPlan)) {
    return NextResponse.json({ error: "Target plan must be higher than your current plan." }, { status: 400 });
  }

  const amountDueTodayUsd = fullPlanPriceUsd(targetPlan, interval);
  const newRenewalDate = billingPeriodEndFromNow(interval);
  const preview = {
    currentPlan: { id: currentPlan, name: PLAN_DISPLAY[currentPlan].name },
    newPlan: {
      id: targetPlan,
      name: PLAN_DISPLAY[targetPlan].name,
      buildCredits: monthlyTokensForPlan(targetPlan),
      actionCredits: monthlyActionCreditsForPlan(targetPlan),
    },
    amountDueTodayUsd,
    proratedAmountUsd: null,
    newRenewalDate,
    policyMessage: UPGRADE_POLICY_COPY.upgradeSummary,
  };

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = getAppUrl();
  const email = user.email ?? "";
  if (!email) {
    return NextResponse.json({ error: "Account email required for checkout" }, { status: 400 });
  }

  const existingSubId = profile?.stripe_subscription_id?.trim();

  if (existingSubId) {
    const updated = await updatePaddleSubscriptionPlan({
      subscriptionId: existingSubId,
      planId: targetPlan,
      userId: user.id,
      billingIntent: interval === "yearly" ? "interval_change" : "upgrade",
      billingInterval: interval,
    });

    if (!updated.ok) {
      return NextResponse.json(
        { error: updated.error, code: updated.code, preview },
        { status: updated.code === "setup_required" ? 503 : 502 },
      );
    }

    return NextResponse.json({
      mode: "paddle_subscription_update",
      prorationBillingMode: "full_immediately",
      subscriptionId: updated.subscriptionId,
      preview,
      message:
        "Paddle will charge the full new plan price. Credits refresh after payment succeeds (webhook).",
      billingProvider: "paddle",
    });
  }

  const checkout = await createPaddleCheckoutSession({
    planId: targetPlan,
    userId: user.id,
    email,
    successUrl: `${appUrl}/settings/billing?paddle=success`,
    cancelUrl: `${appUrl}/settings/billing?paddle=canceled`,
    billingIntent: "new_subscription",
    billingInterval: interval,
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
