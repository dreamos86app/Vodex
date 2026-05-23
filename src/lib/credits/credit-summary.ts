import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import type { ProfileBillingRow } from "@/lib/supabase/load-profile-billing";

export type CreditSummary = {
  /** Spendable balance — same field as profiles.credits_remaining. */
  available: number;
  /** Monthly plan allowance (informational). */
  planAllowance: number;
  usedThisPeriod: number;
  reserved: number;
  resetAt: string | null;
  planId: string;
};

/** Display credits — one decimal when needed (26.8), whole numbers otherwise. */
export function formatCreditAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return Math.round(rounded).toLocaleString();
  }
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function loadCreditSummary(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileBillingRow,
): Promise<CreditSummary> {
  const planId = normalizePlanId(profile.plan_id ?? "free");
  const planAllowance = profile.credits_limit ?? monthlyTokensForPlan(planId);
  const available = Math.max(0, profile.credits_remaining ?? 0);

  const periodStart = profile.credits_reset_at
    ? new Date(profile.credits_reset_at)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [{ data: usage }, { data: reservations }] = await Promise.all([
    supabase
      .from("credit_events")
      .select("credits_consumed")
      .eq("user_id", userId)
      .eq("event_type", "generation")
      .gte("created_at", periodStart.toISOString()),
    supabase
      .from("credit_reservations")
      .select("reserved_user_credits")
      .eq("user_id", userId)
      .eq("status", "reserved"),
  ]);

  const usedThisPeriod =
    usage?.reduce((sum, row) => sum + (row.credits_consumed ?? 0), 0) ?? 0;

  const reserved =
    reservations?.reduce((sum, row) => sum + (row.reserved_user_credits ?? 0), 0) ?? 0;

  return {
    available,
    planAllowance,
    usedThisPeriod,
    reserved,
    resetAt: profile.credits_reset_at,
    planId,
  };
}
