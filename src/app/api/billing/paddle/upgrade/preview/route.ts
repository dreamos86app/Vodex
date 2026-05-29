import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { billablePlanDefinition, billablePlanToPlanId } from "@/lib/billing/plan-billing-catalog";
import { validateCheckoutPlanInterval } from "@/lib/billing/paddle-billing";
import { monthlyTokensForPlan, normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import {
  billingPeriodEndFromNow,
  fullPlanPriceUsd,
  isPlanUpgrade,
  UPGRADE_POLICY_COPY,
  type BillingInterval,
} from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";

const schema = z.object({
  planId: z.string(),
  interval: z.enum(["monthly", "yearly", "annual"]).optional().default("monthly"),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    planId: url.searchParams.get("planId"),
    interval: url.searchParams.get("interval") ?? "monthly",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const catalogInterval = parsed.data.interval === "annual" ? "annual" : "monthly";
  const validated = validateCheckoutPlanInterval(parsed.data.planId, catalogInterval);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const targetPlan = validated.plan;
  const targetStoragePlan = billablePlanToPlanId(targetPlan);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", user.id)
    .single();

  const currentPlan = normalizePlanId(profile?.plan_id ?? "free") as PlanId;
  const interval = (parsed.data.interval === "annual" ? "yearly" : parsed.data.interval) as BillingInterval;

  if (!isPlanUpgrade(currentPlan, targetStoragePlan) && currentPlan !== targetStoragePlan) {
    return NextResponse.json(
      { error: "Use downgrade flow for lower plans. Downgrades apply at next renewal." },
      { status: 400 },
    );
  }

  const amountDueTodayUsd = fullPlanPriceUsd(validated.plan, interval);
  const newRenewalDate = billingPeriodEndFromNow(interval);

  return NextResponse.json({
    currentPlan: { id: currentPlan, name: PLAN_DISPLAY[currentPlan].name },
    newPlan: {
      id: targetStoragePlan,
      billableSlug: targetPlan,
      name: billablePlanDefinition(targetPlan).label,
      buildCredits: monthlyTokensForPlan(targetStoragePlan),
      actionCredits: monthlyActionCreditsForPlan(targetStoragePlan),
    },
    amountDueTodayUsd,
    proratedAmountUsd: null,
    prorationPolicy: "none",
    fullCycleRestart: true,
    newRenewalDate,
    billingInterval: interval,
    policyMessage: UPGRADE_POLICY_COPY.upgradeSummary,
    noProrationMessage: UPGRADE_POLICY_COPY.noProration,
  });
}
