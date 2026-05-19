import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { z } from "zod";
import {
  getStripePriceId,
  isStripeCheckoutPlan,
  missingStripeEnvVars,
  monthlyTokensForPlan,
  PLAN_DISPLAY,
} from "@/lib/billing/plans";

const schema = z.object({
  planId: z.string(),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  const missing = missingStripeEnvVars();
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Stripe is not configured", missingEnv: missing },
      { status: 503 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirm upgrade details before continuing to checkout." },
      { status: 400 },
    );
  }

  const planId = parsed.data.planId;
  if (!isStripeCheckoutPlan(planId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = getStripePriceId(planId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured for this plan", missingEnv: [`STRIPE_${planId.toUpperCase()}_PRICE_ID`] },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, stripe_customer_id, plan_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dreamos86.com";
  const tokens = monthlyTokensForPlan(planId);
  const display = PLAN_DISPLAY[planId];

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings/billing?canceled=true`,
    metadata: {
      user_id: user.id,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan_id: planId,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({
    url: session.url,
    summary: {
      plan: display.name,
      price: display.priceMonthlyUsd,
      tokens,
      message:
        "You will complete payment on Stripe. Your new billing period and token allowance start when payment succeeds.",
    },
  });
}
