import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import { paddlePublicCheckoutEnabled } from "@/lib/billing/paddle-public-checkout";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { loadCanonicalCredits } from "@/lib/credits/canonical-credits";
import { buildPlanChangeDiagnostics } from "@/lib/billing/plan-change-diagnostics";
import { loadPaddleBillingContextForUser } from "@/lib/billing/paddle-billing-context";
import { paddleEnvironment } from "@/lib/billing/paddle-billing";
import { diagnoseBillingAttempt } from "@/lib/billing/diagnose-billing-attempt";
import { loadBillingAttemptTrace } from "@/lib/billing/billing-attempt-trace";

export type BillingProcessingState =
  | "idle"
  | "awaiting_webhook"
  | "entitled"
  | "failed"
  | "past_due";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const txn = url.searchParams.get("transactionId");
  const attemptId = url.searchParams.get("attemptId");

  const email = user.email?.trim() ?? "";
  const billingCtx = email
    ? await loadPaddleBillingContextForUser(user.id, email)
    : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "plan_id, subscription_status, paddle_subscription_id, paddle_customer_id, billing_provider, credits_remaining, credits_reset_at",
    )
    .eq("id", user.id)
    .single();

  const planId = normalizePlanId(profile?.plan_id ?? "free");
  const paddle = getPaddleBillingStatus();

  const admin = createSupabaseAdmin();
  let webhookPending = false;
  let lastWebhookStatus: string | null = null;
  let lastWebhookEventType: string | null = null;
  let lastWebhookAt: string | null = null;
  let entitlementApplied = false;
  let lastBillingError: string | null = null;
  let latestDiagnostics: Record<string, unknown> | null = null;

  const { data: recentEvents } = await admin
    .from("billing_events")
    .select("event_type, metadata, created_at, stripe_event_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = recentEvents ?? [];

  const entitlementRow = rows.find((e) => e.event_type === "paddle.entitlement.applied");
  if (entitlementRow) entitlementApplied = true;

  const paddleWebhookRows = rows.filter((e) => String(e.event_type ?? "").startsWith("paddle."));

  if (paddleWebhookRows[0]) {
    lastWebhookAt = paddleWebhookRows[0].created_at ?? null;
  }

  if (txn) {
    const related = paddleWebhookRows.filter((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const tid = meta.paddle_transaction_id ?? meta.transaction_id;
      return tid === txn;
    });
    const processed = related.some((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      return meta.processing_status === "processed";
    });
    entitlementApplied =
      entitlementApplied ||
      related.some((e) => e.event_type === "paddle.entitlement.applied");
    webhookPending = !processed && !entitlementApplied;
    const latest = related[0] ?? paddleWebhookRows[0];
    if (latest?.metadata) {
      const meta = latest.metadata as Record<string, unknown>;
      lastWebhookStatus = String(meta.processing_status ?? "");
      lastWebhookEventType = String(latest.event_type ?? "").replace(/^paddle\./, "");
      lastBillingError = meta.error != null ? String(meta.error) : null;
      latestDiagnostics = {
        event_id: latest.stripe_event_id,
        event_type: latest.event_type,
        processing_status: meta.processing_status,
        error: meta.error ?? null,
        received_at: meta.received_at ?? latest.created_at,
        processed_at: meta.processed_at ?? null,
      };
    }
  } else {
    const latest = paddleWebhookRows[0];
    if (latest?.metadata) {
      const meta = latest.metadata as Record<string, unknown>;
      lastWebhookStatus = String(meta.processing_status ?? "");
      lastWebhookEventType = String(latest.event_type ?? "").replace(/^paddle\./, "");
      lastBillingError = meta.error != null ? String(meta.error) : null;
      latestDiagnostics = {
        event_id: latest.stripe_event_id,
        event_type: latest.event_type,
        processing_status: meta.processing_status,
        error: meta.error ?? null,
      };
    }
    webhookPending =
      !entitlementApplied &&
      planId === "free" &&
      paddleWebhookRows.length > 0 &&
      lastWebhookStatus !== "processed" &&
      lastWebhookStatus !== "payment_failed_no_upgrade";
  }

  const canonical = await loadCanonicalCredits({
    userId: user.id,
    planId,
    creditsResetAt: profile?.credits_reset_at,
    buildAvailable: profile?.credits_remaining,
  });

  const isPaid = planId !== "free";
  const active =
    isPaid &&
    profile?.subscription_status !== "past_due" &&
    (entitlementApplied || !webhookPending);

  let processingState: BillingProcessingState = "idle";
  if (profile?.subscription_status === "past_due") {
    processingState = "past_due";
  } else if (lastWebhookStatus === "failed" || lastWebhookStatus === "payment_failed_no_upgrade") {
    processingState = "failed";
  } else if (webhookPending) {
    processingState = "awaiting_webhook";
  } else if (entitlementApplied || (isPaid && !webhookPending)) {
    processingState = "entitled";
  }

  const failureReasons = buildPlanChangeDiagnostics({
    profilePlanId: planId,
    subscriptionStatus: profile?.subscription_status,
    paddleConfigured: paddle.configured,
    paddleEnvironment: paddle.environment,
    webhookPending,
    entitlementApplied,
    lastWebhookStatus,
    lastWebhookEventType,
    lastWebhookError: lastBillingError,
    transactionId: txn,
    recentEventTypes: rows.map((e) => String(e.event_type ?? "")),
  });

  const attemptDiagnosis = attemptId ? await diagnoseBillingAttempt(attemptId) : null;
  const attemptTrace = attemptId ? await loadBillingAttemptTrace(attemptId) : null;

  return NextResponse.json({
    planId,
    currentPlan: planId,
    pendingPlan: billingCtx?.pendingDowngradePlan ?? null,
    subscriptionStatus: profile?.subscription_status ?? (isPaid ? "active" : "free"),
    active,
    webhookPending,
    entitlementApplied,
    processingState,
    lastWebhookStatus,
    lastWebhookEventType,
    lastWebhookAt,
    lastBillingError,
    activeSubscriptionId: profile?.paddle_subscription_id ?? billingCtx?.paddleSubscriptionId ?? null,
    environmentMode: paddleEnvironment(),
    latestWebhook: latestDiagnostics,
    message: webhookPending
      ? "Payment completed — waiting for Paddle webhook. Plan and credits update only after verified processing."
      : active
        ? "Your plan is active."
        : entitlementApplied
          ? "Entitlements applied — refreshing credits."
          : isPaid
            ? "Plan active — syncing credits."
            : "No paid plan detected yet.",
    buildCredits: {
      remaining: canonical.build.available,
      allowance: canonical.build.planAllowance,
      bonus: canonical.build.bonusActive,
      cap: canonical.build.planAllowance + canonical.build.bonusActive,
    },
    actionCredits: {
      remaining: canonical.action.available,
      allowance: canonical.action.planAllowance,
      bonus: canonical.action.bonusActive,
      cap: canonical.action.planAllowance + canonical.action.bonusActive,
    },
    paddle: {
      configured: paddle.configured,
      environment: paddle.environment,
      publicCheckoutEnabled: paddlePublicCheckoutEnabled(),
    },
    failureReasons: active && entitlementApplied ? [] : failureReasons,
    billingAttemptId: attemptId,
    attemptDiagnosis: attemptDiagnosis
      ? {
          code: attemptDiagnosis.code,
          message: attemptDiagnosis.message,
          success: attemptDiagnosis.success,
          live: attemptDiagnosis.live,
        }
      : null,
    attemptTrace: attemptTrace
      ? {
          billing_attempt_id: attemptTrace.billing_attempt_id,
          endpoint_called: attemptTrace.endpoint_called,
          resolved_action: attemptTrace.resolved_action,
          webhook_received: attemptTrace.webhook_received,
          webhook_verified: attemptTrace.webhook_verified,
          webhook_event_type: attemptTrace.webhook_event_type,
          webhook_processing_status: attemptTrace.webhook_processing_status,
          entitlement_apply_started: attemptTrace.entitlement_apply_started,
          entitlement_apply_completed: attemptTrace.entitlement_apply_completed,
          plan_before: attemptTrace.current_plan_before,
          plan_after: attemptTrace.plan_after,
          build_before: attemptTrace.current_build_credits_before,
          build_after: attemptTrace.build_credits_after,
          action_before: attemptTrace.current_action_credits_before,
          action_after: attemptTrace.action_credits_after,
          period_end_before: attemptTrace.current_period_end_before,
          period_end_after: attemptTrace.period_end_after,
          paddle_transaction_id: attemptTrace.paddle_transaction_id,
          paddle_subscription_id: attemptTrace.paddle_subscription_id,
          paddle_price_id: attemptTrace.paddle_price_id,
          failure_code: attemptTrace.failure_code,
          failure_message: attemptTrace.failure_message,
        }
      : null,
    upgradeComplete: attemptDiagnosis?.success ?? false,
  });
}
