import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { cancelPaddleSubscriptionAtPeriodEnd } from "@/lib/billing/paddle-api";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";

const schema = z.object({ confirmed: z.literal(true) });

export async function POST(request: Request) {
  const status = getPaddleBillingStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: status.userMessage, code: "setup_required", paddle: status },
      { status: 503 },
    );
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

  const result = await cancelPaddleSubscriptionAtPeriodEnd(profile.stripe_subscription_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 502 });
  }

  const admin = createSupabaseAdmin();
  const periodEndIso = result.currentPeriodEnd ?? null;

  const periodEndUpdate = periodEndIso ?? undefined;

  await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true, current_period_end: periodEndUpdate } as never)
    .eq("stripe_subscription_id", profile.stripe_subscription_id);

  await admin
    .from("profiles")
    .update({ cancel_at_period_end: true, current_period_end: periodEndUpdate } as never)
    .eq("id", user.id);

  const periodEndLabel = periodEndIso
    ? new Date(periodEndIso).toLocaleDateString()
    : "the end of your billing period";

  return NextResponse.json({
    success: true,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: periodEndIso,
    message: `Renewal canceled. Your plan stays active until ${periodEndLabel}.`,
    billingProvider: "paddle",
  });
}
