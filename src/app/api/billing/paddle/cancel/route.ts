import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { cancelPaddleSubscriptionAtPeriodEnd } from "@/lib/billing/paddle-api";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";
import { updateSubscriptionByPaddleId } from "@/lib/billing/paddle-subscription-legacy-store";

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
    .select(PROFILE_PADDLE_BILLING_SELECT)
    .eq("id", user.id)
    .single();

  const paddleSubscriptionId = readProfilePaddleSubscriptionId(profile ?? undefined);
  if (!paddleSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const result = await cancelPaddleSubscriptionAtPeriodEnd(paddleSubscriptionId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 502 });
  }

  const admin = createSupabaseAdmin();
  const periodEndIso = result.currentPeriodEnd ?? null;

  const periodEndUpdate = periodEndIso ?? undefined;

  await updateSubscriptionByPaddleId(admin, paddleSubscriptionId, {
    cancel_at_period_end: true,
    current_period_end: periodEndUpdate,
  });

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
