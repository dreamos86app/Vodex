import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isStripeCheckoutPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { isPlanDowngrade, UPGRADE_POLICY_COPY } from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";

const schema = z.object({
  planId: z.string(),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm downgrade before scheduling." }, { status: 400 });
  }

  const targetPlan = normalizePlanId(parsed.data.planId) as PlanId;
  if (!isStripeCheckoutPlan(targetPlan) && targetPlan !== "free") {
    return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const currentPlan = normalizePlanId(profile?.plan_id ?? "free");
  if (!isPlanDowngrade(currentPlan, targetPlan)) {
    return NextResponse.json({ error: "Target plan must be lower than your current plan." }, { status: 400 });
  }

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription to downgrade" }, { status: 400 });
  }

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("stripe_subscription_id", profile.stripe_subscription_id)
    .maybeSingle();

  await supabase
    .from("subscriptions")
    .update({ pending_downgrade_plan: targetPlan })
    .eq("stripe_subscription_id", profile.stripe_subscription_id);

  const periodEnd = subRow?.current_period_end ?? null;

  return NextResponse.json({
    success: true,
    pendingDowngradePlan: targetPlan,
    currentPeriodEnd: periodEnd,
    policyMessage: UPGRADE_POLICY_COPY.downgradeSummary,
    message: `Your ${PLAN_DISPLAY[currentPlan].name} plan stays active until ${
      periodEnd ? new Date(periodEnd).toLocaleDateString() : "your next renewal"
    }. ${PLAN_DISPLAY[targetPlan].name} starts on the next billing cycle.`,
    billingProvider: "paddle",
  });
}
