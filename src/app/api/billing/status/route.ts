import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import { paddlePublicCheckoutEnabled } from "@/lib/billing/paddle-public-checkout";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";

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
    .select("plan_id, subscription_status, stripe_subscription_id, credits_remaining, credits_reset_at")
    .eq("id", user.id)
    .single();

  const planId = normalizePlanId(profile?.plan_id ?? "free");
  const paddle = getPaddleBillingStatus();

  const admin = createSupabaseAdmin();
  let webhookPending = false;
  let lastWebhookStatus: string | null = null;

  if (txn) {
    const { data: events } = await admin
      .from("billing_events")
      .select("metadata, event_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = events ?? [];
    const processed = rows.some((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const tid = meta.paddle_transaction_id ?? meta.transaction_id;
      const status = meta.processing_status;
      return tid === txn && status === "processed";
    });
    webhookPending = !processed;
    const latest = rows.find((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      return meta.paddle_transaction_id === txn || meta.transaction_id === txn;
    });
    if (latest?.metadata) {
      lastWebhookStatus = String((latest.metadata as Record<string, unknown>).processing_status ?? "");
    }
  }

  const isPaid = planId !== "free";
  const active = isPaid && profile?.subscription_status !== "past_due";

  return NextResponse.json({
    planId,
    subscriptionStatus: profile?.subscription_status ?? (isPaid ? "active" : "free"),
    active,
    webhookPending,
    lastWebhookStatus,
    message: webhookPending
      ? "Payment completed — still waiting for Paddle webhook. Refresh in a moment or contact support."
      : active
        ? "Your plan is active."
        : "Payment received — activating your plan.",
    buildCredits: {
      remaining: profile?.credits_remaining ?? 0,
      allowance: monthlyTokensForPlan(planId),
    },
    actionCredits: {
      allowance: monthlyActionCreditsForPlan(planId),
    },
    paddle: {
      configured: paddle.configured,
      environment: paddle.environment,
      publicCheckoutEnabled: paddlePublicCheckoutEnabled(),
    },
  });
}
