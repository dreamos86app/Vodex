import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createPaddleCustomerPortalSession,
  isPaddleCustomerId,
} from "@/lib/billing/paddle-customer-portal";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import {
  PROFILE_PADDLE_BILLING_SELECT,
  readProfilePaddleSubscriptionId,
} from "@/lib/billing/paddle-profile-fields";

export async function POST() {
  const paddle = getPaddleBillingStatus();
  if (!paddle.configured) {
    return NextResponse.json(
      { error: paddle.userMessage, code: "setup_required" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select(PROFILE_PADDLE_BILLING_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  const paddleCustomerId = isPaddleCustomerId(profile?.paddle_customer_id)
    ? profile!.paddle_customer_id!.trim()
    : null;

  if (!paddleCustomerId) {
    return NextResponse.json(
      {
        error:
          "No Paddle customer is linked to this account yet. Complete checkout first or contact support.",
        code: "missing_customer",
      },
      { status: 400 },
    );
  }

  const paddleSubscriptionId = readProfilePaddleSubscriptionId(profile ?? undefined);

  const result = await createPaddleCustomerPortalSession({
    paddleCustomerId,
    paddleSubscriptionId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "missing_customer" ? 400 : 502 },
    );
  }

  return NextResponse.json({
    url: result.url,
    sessionId: result.sessionId,
    billingProvider: "paddle",
  });
}
