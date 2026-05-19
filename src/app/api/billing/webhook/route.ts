import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";

function planFromStripePrice(priceId: string): PlanId {
  if (priceId && priceId === process.env.STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId && priceId === process.env.STRIPE_INFINITY_PRICE_ID) return "infinity";
  return "pro";
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const inv = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const ref = inv.subscription;
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return ref.id;
  return undefined;
}

function subscriptionPeriod(sub: Stripe.Subscription): { start: string; end: string } {
  const legacy = sub as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const startSec = legacy.current_period_start ?? Math.floor(Date.now() / 1000);
  const endSec = legacy.current_period_end ?? startSec + 30 * 24 * 60 * 60;
  return {
    start: new Date(startSec * 1000).toISOString(),
    end: new Date(endSec * 1000).toISOString(),
  };
}

async function upsertSubscriptionRow(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  sub: Stripe.Subscription,
  planId: PlanId,
) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? "";
  const period = subscriptionPeriod(sub);
  const pendingRaw = sub.metadata?.pending_downgrade_plan;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_price_id: priceId,
      plan_id: planId,
      plan_interval: item?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      credits_per_period: monthlyTokensForPlan(planId),
      status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete",
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      pending_downgrade_plan: pendingRaw ? normalizePlanId(pendingRaw) : null,
    },
    { onConflict: "stripe_subscription_id" },
  );
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const planMeta = session.metadata?.plan_id;
      if (!userId || !planMeta) break;

      const planId = normalizePlanId(planMeta);
      const tokens = monthlyTokensForPlan(planId);
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        periodEnd = subscriptionPeriod(sub).end;
        await upsertSubscriptionRow(admin, userId, sub, planId);
      }

      await admin
        .from("profiles")
        .update({
          plan_id: planId,
          credits_remaining: tokens,
          credits_reset_at: periodEnd,
          stripe_subscription_id: subId ?? null,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
        })
        .eq("id", userId);

      await admin.rpc("record_token_ledger", {
        p_user_id: userId,
        p_amount: -tokens,
        p_source: "purchase",
        p_reason: `Checkout completed — ${planId}`,
        p_metadata: { stripe_event_id: event.id, plan_id: planId },
      });

      await admin.from("billing_events").insert({
        user_id: userId,
        stripe_event_id: event.id,
        event_type: "checkout.session.completed",
        amount_usd: session.amount_total ? session.amount_total / 100 : 0,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subId ?? null,
      });

      await admin.from("notifications").insert({
        user_id: userId,
        type: "credit",
        title: "Plan activated",
        body: `Your ${planId} plan is active. ${tokens.toLocaleString()} tokens added for this billing period.`,
        action_url: "/settings/billing",
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      const priceId = sub.items.data[0]?.price?.id ?? "";
      const planFromMeta = sub.metadata?.plan_id
        ? normalizePlanId(sub.metadata.plan_id)
        : planFromStripePrice(priceId);

      const pendingDowngrade = sub.metadata?.pending_downgrade_plan
        ? normalizePlanId(sub.metadata.pending_downgrade_plan)
        : null;

      await upsertSubscriptionRow(admin, userId, sub, planFromMeta);

      const effectivePlan =
        pendingDowngrade && sub.cancel_at_period_end === false && sub.status === "active"
          ? planFromMeta
          : planFromMeta;

      let planForProfile: PlanId = effectivePlan;
      if (event.type === "customer.subscription.updated") {
        const now = Math.floor(Date.now() / 1000);
        const periodStart = Math.floor(new Date(subscriptionPeriod(sub).start).getTime() / 1000);
        if (now >= periodStart && pendingDowngrade) {
          planForProfile = pendingDowngrade;
          await admin
            .from("subscriptions")
            .update({ pending_downgrade_plan: null })
            .eq("stripe_subscription_id", sub.id);
        } else if (!pendingDowngrade) {
          planForProfile = effectivePlan;
        }
      }

      const stripeCustomerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      await admin
        .from("profiles")
        .update({
          stripe_subscription_id: sub.id,
          stripe_customer_id: stripeCustomerId,
          plan_id: planForProfile,
        })
        .eq("id", userId);

      await admin.from("billing_events").insert({
        user_id: userId,
        stripe_event_id: event.id,
        event_type: event.type,
        amount_usd: 0,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: sub.id,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      await admin
        .from("profiles")
        .update({
          plan_id: "free",
          credits_remaining: monthlyTokensForPlan("free"),
          stripe_subscription_id: null,
          credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.id);

      await admin.from("billing_events").insert({
        user_id: userId,
        stripe_event_id: event.id,
        event_type: "customer.subscription.deleted",
        amount_usd: 0,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
      });

      await admin.from("notifications").insert({
        user_id: userId,
        type: "credit",
        title: "Subscription ended",
        body: "Your paid plan has ended. You are on the Free plan until you subscribe again.",
        action_url: "/settings/billing",
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      const planId = sub.metadata?.plan_id
        ? normalizePlanId(sub.metadata.plan_id)
        : planFromStripePrice(sub.items.data[0]?.price?.id ?? "");
      const tokens = monthlyTokensForPlan(planId);
      const periodEnd = subscriptionPeriod(sub).end;

      await admin
        .from("profiles")
        .update({
          credits_remaining: tokens,
          credits_reset_at: periodEnd,
          plan_id: planId,
        })
        .eq("id", userId);

      await admin.rpc("record_token_ledger", {
        p_user_id: userId,
        p_amount: -tokens,
        p_source: "monthly_reset",
        p_reason: "Invoice payment succeeded — period renewal",
        p_metadata: { invoice_id: invoice.id },
      });

      await admin.from("billing_events").insert({
        user_id: userId,
        stripe_event_id: event.id,
        event_type: "invoice.payment_succeeded",
        amount_usd: invoice.amount_paid / 100,
        stripe_customer_id: invoice.customer as string,
        stripe_subscription_id: subscriptionId,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      await admin
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);

      await admin.from("billing_events").insert({
        user_id: userId,
        stripe_event_id: event.id,
        event_type: "invoice.payment_failed",
        amount_usd: invoice.amount_due / 100,
        stripe_customer_id: invoice.customer as string,
        stripe_subscription_id: subscriptionId,
      });

      await admin.from("notifications").insert({
        user_id: userId,
        type: "system",
        title: "Payment failed",
        body: "We could not process your subscription payment. Update your billing method in the portal.",
        action_url: "/settings/billing",
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
