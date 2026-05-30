import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { billablePlanFromStoragePlanId } from "@/lib/billing/plan-billing-catalog";
import { isPlanDowngrade, UPGRADE_POLICY_COPY } from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";
import {
  fetchSubscriptionByPaddleId,
  updateSubscriptionByPaddleId,
} from "@/lib/billing/paddle-subscription-legacy-store";

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
  if (targetPlan !== "free" && !billablePlanFromStoragePlanId(targetPlan)) {
    return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select(`plan_id, ${PROFILE_PADDLE_BILLING_SELECT}`)
    .eq("id", user.id)
    .single();

  const currentPlan = normalizePlanId(profile?.plan_id ?? "free");
  if (!isPlanDowngrade(currentPlan, targetPlan)) {
    return NextResponse.json({ error: "Target plan must be lower than your current plan." }, { status: 400 });
  }

  const paddleSubscriptionId = readProfilePaddleSubscriptionId(profile ?? undefined);
  if (!paddleSubscriptionId) {
    return NextResponse.json({ error: "No active subscription to downgrade" }, { status: 400 });
  }

  const subRow = await fetchSubscriptionByPaddleId(
    supabase,
    paddleSubscriptionId,
    "current_period_end",
  );

  await updateSubscriptionByPaddleId(supabase, paddleSubscriptionId, {
    pending_downgrade_plan: targetPlan,
  });

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
