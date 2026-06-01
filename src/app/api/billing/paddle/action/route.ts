import { NextResponse } from "next/server";
import { z } from "zod";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { assertPaddleCheckoutSupabaseConsistency } from "@/lib/billing/paddle-local-testing";
import {
  paddleOwnerTestCheckoutEnabled,
  paddlePublicCheckoutEnabled,
  publicCheckoutBlockedMessage,
} from "@/lib/billing/paddle-public-checkout";
import { loadPaddleBillingContextFromSession } from "@/lib/billing/paddle-billing-context";
import { executePaddleBillingAction } from "@/lib/billing/execute-paddle-billing-action";
import { buildPlanChangeDiagnostics } from "@/lib/billing/plan-change-diagnostics";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import {
  billablePlanToPlanId,
  normalizeBillablePlanId,
  resolveCatalogTier,
  resolvePaddlePriceId,
} from "@/lib/billing/plan-billing-catalog";
import { monthlyTokensForPlan } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import type { PlanChangeSource } from "@/lib/billing/plan-change-router";
import { loadBillingTruthForUser } from "@/lib/billing/billing-truth";

const schema = z
  .object({
    plan: z.string().optional(),
    planId: z.string().optional(),
    interval: z.enum(["monthly", "annual"]).default("monthly"),
    confirmed: z.literal(true),
    testMode: z.boolean().optional(),
    source: z.enum(["pricing", "admin_test_checkout", "settings"]).optional(),
    billingAttemptId: z.string().uuid().optional(),
    promoCode: z.string().max(32).optional(),
    discountId: z.string().max(64).optional(),
  })
  .refine((d) => d.plan ?? d.planId, { message: "plan is required" })
  .refine((d) => !(d.promoCode?.trim() && d.discountId?.trim()), {
    message: "Provide promoCode or discountId, not both",
  });

export async function POST(request: Request) {
  const session = await loadPaddleBillingContextFromSession();
  if (!session.ok) {
    if (session.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Account email required for billing" }, { status: 400 });
  }

  const { ctx } = session;
  const status = getPaddleBillingStatus();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm billing action before continuing." }, { status: 400 });
  }

  const isOwner = isDreamosOwnerEmail(ctx.email);
  const testMode = parsed.data.testMode ?? parsed.data.source === "admin_test_checkout";
  const source: PlanChangeSource =
    parsed.data.source === "admin_test_checkout"
      ? "owner_test_checkout"
      : parsed.data.source === "settings"
        ? "billing_page"
        : "pricing_page";

  if (testMode) {
    if (!isOwner) {
      return NextResponse.json({ error: "Owner-only test checkout" }, { status: 403 });
    }
    if (!paddleOwnerTestCheckoutEnabled()) {
      return NextResponse.json(
        {
          error:
            "Owner test checkout is disabled. Set PADDLE_OWNER_TEST_CHECKOUT_ENABLED=true and restart.",
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
  const billable = normalizeBillablePlanId(planKey);
  if (!billable) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const supabaseGate = assertPaddleCheckoutSupabaseConsistency();
  if (!supabaseGate.ok) {
    return NextResponse.json(
      { error: supabaseGate.error, code: "supabase_project_mismatch" },
      { status: 400 },
    );
  }

  const billingTruth = await loadBillingTruthForUser(ctx.userId);

  const result = await executePaddleBillingAction({
    ctx,
    targetPlan: billable,
    targetInterval: parsed.data.interval,
    source,
    testMode,
    billingAttemptId: parsed.data.billingAttemptId,
    promoCode: parsed.data.promoCode,
    discountId: parsed.data.discountId,
  });

  const resolutionPayload = {
    planChange: {
      action: result.resolution.unifiedAction,
      legacyAction: result.resolution.action,
      label: result.resolution.label,
      description: result.resolution.description,
      billingIntent: result.resolution.billingIntent,
      apiRoute: result.resolution.apiRoute,
      hasActiveSubscription: result.resolution.hasActiveSubscription,
    },
  };

  if (!result.ok) {
    const failureReasons = buildPlanChangeDiagnostics({
      profilePlanId: ctx.currentPlanId,
      paddleConfigured: status.configured,
      paddleEnvironment: status.environment,
      recentEventTypes: [],
    });
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...resolutionPayload,
        billingTruth,
        usePortal: result.usePortal,
        requiresConfirmation: result.requiresConfirmation,
        failureReasons: [result.error, billingTruth.visibleWarningMessage, ...failureReasons].filter(
          Boolean,
        ),
      },
      { status: result.httpStatus },
    );
  }

  if (result.mode === "paddle_checkout") {
    const validatedPlan = result.resolution.targetPlan;
    const interval = result.resolution.targetInterval;
    const storagePlan = billablePlanToPlanId(validatedPlan);
    const tier = resolveCatalogTier(validatedPlan, interval);
    const priceId = resolvePaddlePriceId(validatedPlan, interval)!;

    return NextResponse.json({
      mode: result.mode,
      url: result.url,
      transactionId: result.transactionId,
      billingAttemptId: result.billingAttemptId,
      ...resolutionPayload,
      customDataPreview: result.customDataPreview,
      priceId,
      expectedAmountUsd: tier?.amountUsd,
      plan: {
        id: validatedPlan,
        storagePlanId: storagePlan,
        name: result.resolution.label,
        interval,
        buildCredits: monthlyTokensForPlan(storagePlan),
        actionCredits: monthlyActionCreditsForPlan(storagePlan),
      },
      billingProvider: "paddle",
      liveMode: status.environment === "production",
      testMode,
      billingTruth,
      paddleDiscount: result.paddleDiscount ?? null,
      promoCode: parsed.data.promoCode?.trim().toUpperCase() ?? null,
    });
  }

  if (result.mode === "paddle_subscription_update") {
    return NextResponse.json({
      mode: result.mode,
      subscriptionId: result.subscriptionId,
      message: result.message,
      preview: result.preview,
      billingAttemptId: result.billingAttemptId,
      ...resolutionPayload,
      billingProvider: "paddle",
      webhookRequired: true,
      billingTruth,
    });
  }

  return NextResponse.json({
    mode: result.mode,
    pendingDowngradePlan: result.pendingDowngradePlan,
    currentPeriodEnd: result.currentPeriodEnd,
    policyMessage: result.resolution.description,
    ...resolutionPayload,
    billingProvider: "paddle",
  });
}
