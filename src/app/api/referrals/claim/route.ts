import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/referrals/claim
 *
 * Trigger the reward distribution for the *currently signed-in user* as
 * the referred party. Used right after they qualify (complete onboarding,
 * make a first purchase, etc.).
 *
 * Idempotent — the SQL function returns success: false if there's no
 * pending referral, and the reward only fires once per referred user.
 *
 * The function itself enforces caller == p_referred_id, so a malicious
 * client cannot trigger someone else's reward.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("claim_referral_reward", {
    p_referred_id: user.id,
    p_credits: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
