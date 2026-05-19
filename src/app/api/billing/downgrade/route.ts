import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isStripeCheckoutPlan, missingStripeEnvVars, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";

const schema = z.object({
  planId: z.string(),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  const missing = missingStripeEnvVars();
  if (missing.length > 0) {
    return NextResponse.json({ error: "Stripe not configured", missingEnv: missing }, { status: 503 });
  }

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
    .select("plan_id,stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription to downgrade" }, { status: 400 });
  }

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("stripe_subscription_id", profile.stripe_subscription_id)
    .maybeSingle();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  await stripe.subscriptions.update(profile.stripe_subscription_id, {
    metadata: {
      user_id: user.id,
      pending_downgrade_plan: targetPlan,
    },
  });

  await supabase
    .from("subscriptions")
    .update({ pending_downgrade_plan: targetPlan })
    .eq("stripe_subscription_id", profile.stripe_subscription_id);

  const periodEnd = subRow?.current_period_end ?? null;

  return NextResponse.json({
    success: true,
    pendingDowngradePlan: targetPlan,
    currentPeriodEnd: periodEnd,
    message: `Your current plan stays active until ${periodEnd ? new Date(periodEnd).toLocaleDateString() : "the end of your billing period"}. ${PLAN_DISPLAY[targetPlan].name} starts on the next cycle.`,
  });
}
