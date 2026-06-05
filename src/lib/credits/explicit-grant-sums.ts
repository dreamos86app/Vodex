import type { SupabaseClient } from "@supabase/supabase-js";
import {
  capExplicitBonus,
  creditPeriodStart,
  explicitBuildGrantAmount,
  isGrantInCreditPeriod,
} from "@/lib/credits/explicit-grants";

const ACTION_GRANT_TYPES = new Set(["admin_grant", "referral", "grant", "purchase", "top_up"]);

export async function sumExplicitBuildGrants(
  admin: SupabaseClient,
  userId: string,
  creditsResetAt?: string | null,
): Promise<number> {
  const periodStart = creditPeriodStart(creditsResetAt);
  const { data } = await admin
    .from("token_ledger" as never)
    .select("amount, source, metadata, created_at")
    .eq("user_id" as never, userId)
    .neq("amount" as never, 0);

  if (!data?.length) return 0;

  const total = (
    data as Array<{ amount?: number; source?: string; metadata?: unknown; created_at?: string }>
  ).reduce((sum, row) => {
    if (!isGrantInCreditPeriod(row.created_at, periodStart)) return sum;
    return sum + explicitBuildGrantAmount(row);
  }, 0);

  return capExplicitBonus(total);
}

export async function sumExplicitActionGrants(
  admin: SupabaseClient,
  userId: string,
  creditsResetAt?: string | null,
): Promise<number> {
  const periodStart = creditPeriodStart(creditsResetAt);
  const { data } = await admin
    .from("action_credit_events" as never)
    .select("action_credits_charged, action_type, created_at")
    .eq("owner_user_id" as never, userId)
    .is("project_id" as never, null);

  if (!data?.length) return 0;

  const total = (
    data as Array<{ action_credits_charged?: number; action_type?: string; created_at?: string }>
  ).reduce((sum, row) => {
    if (!isGrantInCreditPeriod(row.created_at, periodStart)) return sum;
    const type = String(row.action_type ?? "");
    if (!ACTION_GRANT_TYPES.has(type)) return sum;
    const charged = Number(row.action_credits_charged) || 0;
    if (charged >= 0) return sum;
    return sum + Math.abs(charged);
  }, 0);

  return capExplicitBonus(total);
}
