import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monthlyTokensForPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";
import { fetchSubscriptionByPaddleId } from "@/lib/billing/paddle-subscription-legacy-store";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `plan_id,credits_remaining,credits_reset_at,suspended_at,billing_provider,${PROFILE_PADDLE_BILLING_SELECT}`,
    )
    .eq("id", user.id)
    .single();

  const paddleSubscriptionId = readProfilePaddleSubscriptionId(profile ?? undefined);
  const sub = paddleSubscriptionId
    ? await fetchSubscriptionByPaddleId(
        supabase,
        paddleSubscriptionId,
        "status,current_period_end,current_period_start,cancel_at_period_end,pending_downgrade_plan,plan_id,plan_interval",
      )
    : null;

  const planId = normalizePlanId(profile?.plan_id ?? "free");

  return NextResponse.json({
    planId,
    plan: PLAN_DISPLAY[planId],
    tokensRemaining: profile?.credits_remaining ?? 0,
    monthlyTokens: monthlyTokensForPlan(planId),
    resetAt: profile?.credits_reset_at ?? null,
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          currentPeriodStart: sub.current_period_start,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          pendingDowngradePlan: sub.pending_downgrade_plan,
          planInterval: sub.plan_interval ?? "monthly",
        }
      : null,
    paddle: getPaddleBillingStatus(),
    monthlyActionCredits: monthlyActionCreditsForPlan(planId),
    billingProviderPrimary: profile?.billing_provider ?? "paddle",
    billingProvider: profile?.billing_provider ?? "paddle",
  });
}
