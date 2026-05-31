import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import {
  captureBillingSnapshot,
  loadBillingAttemptTrace,
  type BillingAttemptTrace,
} from "@/lib/billing/billing-attempt-trace";
import { batchUserLevelActionBalances } from "@/lib/admin/batch-action-balances";

export type BillingAttemptDiagnosisCode =
  | "client_action_not_started"
  | "wrong_endpoint_called"
  | "paddle_action_failed"
  | "paddle_webhook_not_received"
  | "paddle_webhook_signature_failed"
  | "missing_custom_data"
  | "missing_user_id"
  | "unknown_price_id"
  | "subscription_owner_not_found"
  | "entitlement_not_started"
  | "plan_not_updated"
  | "build_credits_not_updated"
  | "action_credits_not_updated"
  | "billing_period_not_updated"
  | "status_endpoint_stale"
  | "ui_cache_stale"
  | "processed_successfully";

export type BillingAttemptDiagnosis = {
  code: BillingAttemptDiagnosisCode;
  message: string;
  trace: BillingAttemptTrace | null;
  live: {
    plan_id: string;
    build_credits: number;
    action_credits: number;
    period_end: string | null;
  };
  success: boolean;
};

export async function diagnoseBillingAttempt(
  attemptId: string,
): Promise<BillingAttemptDiagnosis> {
  const trace = await loadBillingAttemptTrace(attemptId);
  if (!trace) {
    return {
      code: "client_action_not_started",
      message: "No billing attempt record found for this id.",
      trace: null,
      live: await liveSnapshot(""),
      success: false,
    };
  }

  const live = await liveSnapshot(trace.user_id);
  const targetPlan = normalizePlanId(trace.target_storage_plan);
  const expectedBuild = monthlyTokensForPlan(targetPlan);
  const expectedAction = monthlyActionCreditsForPlan(targetPlan);

  if (trace.failure_code && trace.failure_message) {
    return {
      code: trace.failure_code as BillingAttemptDiagnosisCode,
      message: trace.failure_message,
      trace,
      live,
      success: false,
    };
  }

  if (!trace.endpoint_called) {
    return {
      code: "client_action_not_started",
      message: "Billing attempt was created but no endpoint was recorded.",
      trace,
      live,
      success: false,
    };
  }

  if (!trace.webhook_received) {
    return {
      code: "paddle_webhook_not_received",
      message:
        "Payment or subscription update may have completed in Paddle, but no webhook was linked to this attempt yet. Confirm https://dreamos86.com/api/webhooks/paddle is delivering events.",
      trace,
      live,
      success: false,
    };
  }

  if (trace.webhook_processing_status === "signature_invalid") {
    return {
      code: "paddle_webhook_signature_failed",
      message: "Webhook arrived but signature verification failed.",
      trace,
      live,
      success: false,
    };
  }

  if (
    trace.webhook_processing_status === "missing_custom_data" ||
    trace.webhook_processing_status === "missing_user_id"
  ) {
    return {
      code:
        trace.webhook_processing_status === "missing_user_id"
          ? "missing_user_id"
          : "missing_custom_data",
      message: "Webhook did not include required custom_data (user_id, plan_id, billing_attempt_id).",
      trace,
      live,
      success: false,
    };
  }

  if (trace.webhook_processing_status === "unknown_price_id") {
    return {
      code: "unknown_price_id",
      message: "Webhook price_id is not mapped in DreamOS86 catalog — check PADDLE_*_PRICE_ID env vars.",
      trace,
      live,
      success: false,
    };
  }

  if (!trace.entitlement_apply_started) {
    return {
      code: "entitlement_not_started",
      message: "Webhook was stored but entitlement application never started.",
      trace,
      live,
      success: false,
    };
  }

  const planOk = live.plan_id === targetPlan;
  const buildOk = live.build_credits >= expectedBuild - 0.5;
  const actionOk = live.action_credits >= expectedAction - 0.5;
  const periodOk =
    trace.period_end_after != null &&
    trace.current_period_end_before !== trace.period_end_after;

  if (!planOk) {
    return {
      code: "plan_not_updated",
      message: `Plan is still ${live.plan_id}; expected ${targetPlan}.`,
      trace,
      live,
      success: false,
    };
  }

  if (!buildOk) {
    return {
      code: "build_credits_not_updated",
      message: `Build credits are ${live.build_credits}; expected at least ${expectedBuild} after upgrade.`,
      trace,
      live,
      success: false,
    };
  }

  if (!actionOk) {
    return {
      code: "action_credits_not_updated",
      message: `User-level action credits are ${live.action_credits}; expected at least ${expectedAction} (project_id IS NULL row).`,
      trace,
      live,
      success: false,
    };
  }

  if (!periodOk && trace.resolved_action !== "scheduled_downgrade") {
    return {
      code: "billing_period_not_updated",
      message: "Plan and credits updated but billing period end did not change — subscription period may be stale.",
      trace,
      live,
      success: false,
    };
  }

  if (!trace.entitlement_apply_completed) {
    return {
      code: "entitlement_not_started",
      message: "Entitlement started but not marked completed — check server logs.",
      trace,
      live,
      success: false,
    };
  }

  return {
    code: "processed_successfully",
    message: "Plan, build credits, action credits, and billing period updated successfully.",
    trace,
    live,
    success: true,
  };
}

async function liveSnapshot(userId: string) {
  if (!userId) {
    return { plan_id: "free", build_credits: 0, action_credits: 0, period_end: null };
  }
  const snap = await captureBillingSnapshot(userId);
  return {
    plan_id: snap.plan_id,
    build_credits: snap.build_credits,
    action_credits: snap.action_credits,
    period_end: snap.period_end,
  };
}

export async function findLatestBillingAttemptId(userId: string): Promise<string | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("billing_events")
    .select("stripe_event_id, metadata")
    .eq("user_id", userId)
    .eq("event_type", "paddle.billing.attempt")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  const trace = meta.trace as BillingAttemptTrace | undefined;
  return trace?.billing_attempt_id ?? null;
}
