import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildReferralInviteUrl,
  MAX_REFERRALS_PER_USER,
  REFERRAL_CREDITS_PER_USER,
} from "@/lib/referrals/referral-config";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REFERRALS = MAX_REFERRALS_PER_USER;

function generateCode(userId: string): string {
  // Deterministic seed from userId so code is stable across requests
  const hash = Buffer.from(userId.replace(/-/g, ""), "hex");
  const seed = hash.readUInt32BE(0) ^ hash.readUInt32BE(4);
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  let n = seed;
  for (let i = 0; i < 8; i++) {
    result += ALPHA[n % ALPHA.length];
    n = Math.imul(n, 1664525) + 1013904223;
    n = n >>> 0;
  }
  return result;
}

async function ensureReferralCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  // Use profiles.referral_code which exists in the real schema
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (profile?.referral_code) return profile.referral_code;

  // Generate a code and persist it
  const code =
    generateCode(userId) +
    randomBytes(2).toString("hex").toUpperCase().slice(0, 4);
  const uniqueCode = code.slice(0, 8);

  await supabase
    .from("profiles")
    .update({ referral_code: uniqueCode })
    .eq("id", userId);

  return uniqueCode;
}

/**
 * GET /api/referrals
 * Returns referral code, invite URL, stats, and referral list.
 * Uses profiles.referral_code + profiles.referred_by (existing schema).
 * Falls back gracefully if referrals table has new Phase-2 schema.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = await ensureReferralCode(supabase, user.id);

  // Fetch people referred by this user
  const { data: referred } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("referred_by", code)
    .order("created_at", { ascending: false })
    .limit(MAX_REFERRALS);

  const list = referred ?? [];

  // The user themselves was referred by whom?
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("referred_by, total_referrals")
    .eq("id", user.id)
    .single();

  const totalReferrals = myProfile?.total_referrals ?? list.length;
  const creditsPerReferral = REFERRAL_CREDITS_PER_USER;
  const creditsEarned = list.length * creditsPerReferral;
  const slotsUsed = list.length;
  const slotsRemaining = Math.max(0, MAX_REFERRALS - slotsUsed);

  const inviteUrl = buildReferralInviteUrl(code);

  const referralRows = list.map((r) => ({
    id: r.id,
    name: r.full_name ?? r.email?.split("@")[0] ?? "User",
    joined: r.created_at,
    status: "rewarded" as const,
    creditsGranted: creditsPerReferral,
  }));

  return NextResponse.json({
    code,
    inviteUrl,
    slotsUsed,
    slotsRemaining,
    maxReferrals: MAX_REFERRALS,
    creditsPerReferral,
    stats: {
      total: totalReferrals,
      rewarded: list.length,
      creditsEarned,
    },
    referrals: referralRows,
    referredBy: myProfile?.referred_by ?? null,
  });
}
