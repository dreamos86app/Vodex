import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { loadCreditSummary } from "@/lib/credits/credit-summary";
import { getChargeTokensProbeCached } from "@/lib/db/charge-probe-cache";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { row: profile, hint } = await loadProfileBillingRow(supabase, user);
  if (!profile) {
    return NextResponse.json(
      {
        error: "Profile not available",
        hint:
          hint ??
          "Apply Supabase migrations for public.profiles and ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 503 },
    );
  }

  const summary = await loadCreditSummary(supabase, user.id, profile);
  const chargeProbe = await getChargeTokensProbeCached();

  return NextResponse.json({
    remaining: summary.available,
    balance: summary.available,
    available: summary.available,
    quota: summary.planAllowance,
    plan_allowance: summary.planAllowance,
    used_this_period: summary.usedThisPeriod,
    reserved: summary.reserved,
    reset_at: summary.resetAt,
    plan_id: summary.planId,
    total_used: summary.usedThisPeriod,
    charging_enabled: chargeProbe.ok,
    charging_error: chargeProbe.ok ? null : chargeProbe.lastError,
  });
}
