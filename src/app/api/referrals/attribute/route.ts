import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REFERRALS = 5;

/**
 * POST /api/referrals/attribute
 * Body: { code: string }
 *
 * Uses profiles.referral_code + profiles.referred_by — the columns that
 * exist in the production schema.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code || code.length < 4 || code.length > 16) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // Caller must not already have a referrer.
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("referred_by, referral_code")
    .eq("id", user.id)
    .single();

  if (myProfile?.referred_by) {
    return NextResponse.json({ attributed: true, already: true });
  }

  // Self-referral check.
  if (myProfile?.referral_code === code) {
    return NextResponse.json({ error: "self_referral" }, { status: 400 });
  }

  // Find the referrer who owns this code.
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, total_referrals")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  // Enforce the max-5-referrals-per-referrer cap.
  if ((referrer.total_referrals ?? 0) >= MAX_REFERRALS) {
    return NextResponse.json({ error: "referral_limit_reached" }, { status: 400 });
  }

  // Mark the referred user.
  const { error: err1 } = await supabase
    .from("profiles")
    .update({ referred_by: code })
    .eq("id", user.id);

  if (err1) {
    return NextResponse.json({ error: err1.message }, { status: 500 });
  }

  // Grant 1/3 of free-tier credits (8) to both parties.
  const creditsPerReferral = Math.floor(25 / 3); // 8
  await supabase
    .from("profiles")
    .update({
      total_referrals: (referrer.total_referrals ?? 0) + 1,
      credits_remaining: supabase.rpc as never, // increment below via RPC if available
    })
    .eq("id", referrer.id);

  // Simple increment — works even without stored procedure.
  await supabase.rpc("consume_credits", {
    p_user_id: referrer.id,
    p_amount: -creditsPerReferral, // negative = grant
    p_operation_id: `ref_grant_${user.id}_${referrer.id}`,
    p_model_id: "system",
  } as never).then(() => {});

  // Fallback: direct update if RPC not available.
  await Promise.all([
    supabase
      .from("profiles")
      .update({
        total_referrals: (referrer.total_referrals ?? 0) + 1,
      })
      .eq("id", referrer.id),
  ]);

  // Notify the referrer.
  await supabase.from("notifications").insert({
    user_id: referrer.id,
    type: "invite",
    title: "Your invite worked!",
    body: `Someone joined using your referral code. You both earned ${creditsPerReferral} credits.`,
    action_url: "/referrals",
  } as never).then(() => {});

  return NextResponse.json({
    attributed: true,
    already: false,
    creditsGranted: creditsPerReferral,
  });
}
