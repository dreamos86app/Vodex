import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import { paddlePublicCheckoutEnabled } from "@/lib/billing/paddle-public-checkout";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { loadCanonicalCredits } from "@/lib/credits/canonical-credits";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const txn = url.searchParams.get("transactionId");

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
  let entitlementApplied = false;
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

  return NextResponse.json({
    planId,
    subscriptionStatus: profile?.subscription_status ?? (isPaid ? "active" : "free"),
    active,
    webhookPending,
    entitlementApplied,
    lastWebhookStatus,
    lastWebhookEventType,
    latestWebhook: latestDiagnostics,
    message: webhookPending
      ? "Payment completed — waiting for Paddle webhook. Refresh in a moment."
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
    },
    actionCredits: {
      remaining: canonical.action.available,
      allowance: canonical.action.planAllowance,
      bonus: canonical.action.bonusActive,
    },
    paddle: {
      configured: paddle.configured,
      environment: paddle.environment,
      publicCheckoutEnabled: paddlePublicCheckoutEnabled(),
    },
  });
}
