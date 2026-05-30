import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPaddleCheckoutSession } from "@/lib/billing/paddle-api";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { getPaddleBillingStatus, validateCheckoutPlanInterval } from "@/lib/billing/paddle-billing";
import {
  billablePlanDefinition,
  billablePlanToPlanId,
  resolveCatalogTier,
  resolvePaddlePriceId,
} from "@/lib/billing/plan-billing-catalog";
import {
  paddleOwnerTestCheckoutEnabled,
  paddlePublicCheckoutEnabled,
  publicCheckoutBlockedMessage,
} from "@/lib/billing/paddle-public-checkout";
import { monthlyTokensForPlan } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { buildPaddleCheckoutCustomData } from "@/lib/billing/paddle-checkout-custom-data";
import { assertPaddleCheckoutSupabaseConsistency } from "@/lib/billing/paddle-local-testing";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanId } from "@/lib/billing/plans";
import {
  resolvePlanChange,
  type PlanChangeSource,
} from "@/lib/billing/plan-change-router";
import { logPlanChangeAttempt } from "@/lib/billing/plan-change-audit";
import type { CatalogBillingInterval } from "@/lib/billing/plan-billing-catalog";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";
import { fetchSubscriptionByPaddleId } from "@/lib/billing/paddle-subscription-legacy-store";
import type { PaddleBillingIntent } from "@/lib/billing/paddle-api";

const schema = z
  .object({
    plan: z.string().optional(),
    planId: z.string().optional(),
    priceId: z.string().optional(),
    interval: z.enum(["monthly", "annual"]).default("monthly"),
    confirmed: z.literal(true),
    testMode: z.boolean().optional(),
    source: z.enum(["pricing", "admin_test_checkout", "settings"]).optional(),
  })
  .refine((d) => d.plan ?? d.planId, { message: "plan is required" });

export async function POST(request: Request) {
  const status = getPaddleBillingStatus();
  if (!status.configured) {
    return NextResponse.json(
      {
        error: status.userMessage,
        code: "setup_required",
        missingEnv: status.missing,
        paddle: status,
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm checkout details before continuing." }, { status: 400 });
  }

  if (parsed.data.priceId) {
    return NextResponse.json(
      { error: "Client-supplied price IDs are not accepted. Use plan and interval only." },
      { status: 400 },
    );
  }

  const isOwner = isDreamosOwnerEmail(user.email);
  const testMode = parsed.data.testMode ?? parsed.data.source === "admin_test_checkout";
  const source = parsed.data.source ?? (testMode ? "admin_test_checkout" : "pricing");

  if (testMode) {
    if (!isOwner) {
      return NextResponse.json({ error: "Owner-only test checkout" }, { status: 403 });
    }
    if (!paddleOwnerTestCheckoutEnabled()) {
      return NextResponse.json(
        {
          error:
            "Owner test checkout is disabled. Set PADDLE_OWNER_TEST_CHECKOUT_ENABLED=true and restart or redeploy.",
        },
        { status: 403 },
      );
    }
  } else if (!paddlePublicCheckoutEnabled() && !isOwner) {
    return NextResponse.json(
      { error: publicCheckoutBlockedMessage(), code: "public_checkout_disabled" },
      { status: 403 },
    );
  }

  const planKey = parsed.data.plan ?? parsed.data.planId!;
  const validated = validateCheckoutPlanInterval(planKey, parsed.data.interval);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error, code: "invalid_price" }, { status: 400 });
  }

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = getAppUrl();
  const email = user.email ?? "";
  if (!email) {
    return NextResponse.json({ error: "Account email required for checkout" }, { status: 400 });
  }

  const priceId = resolvePaddlePriceId(validated.plan, validated.interval)!;
  const tier = resolveCatalogTier(validated.plan, validated.interval);

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select(`plan_id, ${PROFILE_PADDLE_BILLING_SELECT}`)
    .eq("id", user.id)
    .maybeSingle();

  let currentInterval: CatalogBillingInterval | null = null;
  const paddleSubId = readProfilePaddleSubscriptionId(profile ?? undefined);
  if (paddleSubId) {
    const sub = await fetchSubscriptionByPaddleId(admin, paddleSubId, "plan_interval");
    if (sub?.plan_interval === "yearly") currentInterval = "annual";
    else if (sub?.plan_interval === "monthly") currentInterval = "monthly";
  }

  const planChangeSource: PlanChangeSource =
    source === "admin_test_checkout"
      ? "owner_test_checkout"
      : source === "settings"
        ? "billing_page"
        : "pricing_page";

  const planChange = resolvePlanChange({
    currentPlanId: normalizePlanId(profile?.plan_id ?? "free"),
    currentInterval,
    targetPlan: validated.plan,
    targetInterval: validated.interval,
  });

  await logPlanChangeAttempt({
    userId: user.id,
    previousPlan: normalizePlanId(profile?.plan_id ?? "free"),
    targetPlan: validated.plan,
    targetInterval: validated.interval,
    billingIntent: planChange.billingIntent,
    source: planChangeSource,
    action: planChange.action,
    blockedReason: planChange.action !== "checkout" ? planChange.action : null,
  });

  if (planChange.action === "same_plan") {
    return NextResponse.json(
      {
        error: "You are already on this plan.",
        code: "same_plan",
        message: planChange.description,
        planChange,
      },
      { status: 409 },
    );
  }

  if (planChange.action === "highest_plan") {
    return NextResponse.json(
      {
        error: planChange.description,
        code: "highest_plan",
        planChange,
      },
      { status: 409 },
    );
  }

  if (planChange.action === "portal") {
    return NextResponse.json(
      {
        error: planChange.description,
        code: "use_portal",
        message: planChange.label,
        planChange,
        usePortal: true,
      },
      { status: 409 },
    );
  }

  if (planChange.action === "schedule_downgrade") {
    return NextResponse.json(
      {
        error: planChange.description,
        code: "schedule_downgrade",
        message: planChange.confirmationMessage ?? planChange.description,
        planChange,
        requiresConfirmation: true,
      },
      { status: 409 },
    );
  }

  const paddleBillingIntent: PaddleBillingIntent =
    planChange.billingIntent === "upgrade"
      ? "upgrade"
      : planChange.billingIntent === "interval_change"
        ? "interval_change"
        : "new_subscription";

  const supabaseGate = assertPaddleCheckoutSupabaseConsistency();
  if (!supabaseGate.ok) {
    return NextResponse.json(
      { error: supabaseGate.error, code: "supabase_project_mismatch" },
      { status: 400 },
    );
  }

  const customDataPreview = buildPaddleCheckoutCustomData({
    userId: user.id,
    workspaceId: user.id,
    planId: validated.plan,
    interval: validated.interval,
    priceId,
    source,
    billingIntent: paddleBillingIntent,
    testMode,
  });

  const result = await createPaddleCheckoutSession({
    planId: validated.plan,
    interval: validated.interval,
    userId: user.id,
    email,
    successUrl: `${appUrl}/settings/billing?paddle=success&txn=pending`,
    cancelUrl: `${appUrl}/settings/billing?paddle=canceled`,
    billingIntent: paddleBillingIntent,
    source,
    testMode,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        missingEnv: result.missing,
        paddle: getPaddleBillingStatus(),
      },
      { status: result.code === "setup_required" ? 503 : 502 },
    );
  }

  const storagePlan = billablePlanToPlanId(validated.plan);
  const def = billablePlanDefinition(validated.plan);

  return NextResponse.json({
    url: result.checkoutUrl,
    transactionId: result.transactionId,
    paddleCheckoutUrlSent: result.paddleCheckoutUrlSent,
    paddleCheckoutUrlMode: result.paddleCheckoutUrlMode,
    priceId,
    priceIdMasked: priceId.length > 8 ? `…${priceId.slice(-4)}` : priceId,
    expectedAmountUsd: tier.amountUsd,
    customDataPreview,
    plan: {
      id: validated.plan,
      storagePlanId: storagePlan,
      name: def.label,
      interval: validated.interval,
      buildCredits: monthlyTokensForPlan(storagePlan),
      actionCredits: monthlyActionCreditsForPlan(storagePlan),
    },
    billingProvider: "paddle",
    liveMode: status.environment === "production",
    testMode,
  });
}
