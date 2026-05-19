import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monthlyTokensForPlan, missingStripeEnvVars, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id,credits_remaining,credits_reset_at,stripe_subscription_id,stripe_customer_id,suspended_at")
    .eq("id", user.id)
    .single();

  const { data: sub } = profile?.stripe_subscription_id
    ? await supabase
        .from("subscriptions")
        .select(
          "status,current_period_end,current_period_start,cancel_at_period_end,pending_downgrade_plan,plan_id",
        )
        .eq("stripe_subscription_id", profile.stripe_subscription_id)
        .maybeSingle()
    : { data: null };

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
        }
      : null,
    stripe: {
      configured: missingStripeEnvVars().length === 0,
      missingEnv: missingStripeEnvVars(),
    },
  });
}
