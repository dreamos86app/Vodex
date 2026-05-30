import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { missingStripeEnvVars } from "@/lib/billing/plans";
import { dreamosStripeBillingDisabledResponse } from "@/lib/billing/dreamos-billing-provider";

const schema = z.object({ confirmed: z.literal(true) });

export async function POST(request: Request) {
  const blocked = dreamosStripeBillingDisabledResponse();
  if (blocked) return blocked;

  const missing = missingStripeEnvVars();
  if (missing.length > 0) {
    return NextResponse.json({ error: "Stripe not configured", missingEnv: missing }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm cancellation before continuing." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("stripe_subscription_id", profile.stripe_subscription_id)
    .maybeSingle();

  await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("stripe_subscription_id", profile.stripe_subscription_id);

  const periodEnd = subRow?.current_period_end
    ? new Date(subRow.current_period_end).toLocaleDateString()
    : "the end of your billing period";

  return NextResponse.json({
    success: true,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: subRow?.current_period_end ?? null,
    message: `Renewal canceled. Your plan stays active until ${periodEnd}.`,
  });
}
