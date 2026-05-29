/**
 * DreamOS86 — Canonical credit source of truth.
 * All UI and APIs must derive display from loadCanonicalCredits().
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import type { PlanId } from "@/lib/supabase/types";
import { creditCap, normalizeAvailableCredits, repairProfileCreditsIfInflated } from "@/lib/credits/normalize-credit-balance";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";

export type LoadCanonicalCreditsOptions = {
  userId: string;
  planId?: string | null;
  email?: string | null;
  creditsResetAt?: string | null;
  buildAvailable?: number | null;
  actionAvailable?: number | null;
  /** Skip ledger aggregation for fast API reads (default true). */
  skipLedger?: boolean;
};

export const CANONICAL_CREDIT_SOURCE = "canonical_balance" as const;

export type CanonicalCreditBucket = {
  available: number;
  planAllowance: number;
  usedThisPeriod: number;
  bonusActive: number;
  bonusLabel: string | null;
  bonusExpiresAt: string | null;
  resetDate: string | null;
  reserved: number;
  source: typeof CANONICAL_CREDIT_SOURCE;
};

export type CanonicalCreditsPayload = {
  build: CanonicalCreditBucket;
  action: CanonicalCreditBucket;
  planId: PlanId;
};

function roundCredit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/** Active bonus = explicit grants only — never plan-allowance delta. */
export function computeActiveBonus(_available: number, _planAllowance: number, explicitBonus = 0): number {
  return roundCredit(Math.max(0, explicitBonus));
}

const EXPLICIT_GRANT_SOURCES = new Set([
  "admin_grant",
  "referral",
  "grant",
  "purchase",
  "top_up",
]);

export async function sumExplicitBuildGrants(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
): Promise<number> {
  const { data } = await admin
    .from("token_ledger" as never)
    .select("amount, source, metadata")
    .eq("user_id" as never, userId)
    .neq("amount" as never, 0);

  if (!data?.length) return 0;

  return (data as Array<{ amount?: number; source?: string; metadata?: unknown }>).reduce(
    (sum, row) => {
      const source = String(row.source ?? "");
      const amount = Math.abs(Number(row.amount) || 0);
      if (amount <= 0) return sum;
      if (EXPLICIT_GRANT_SOURCES.has(source)) return sum + amount;
      if (source === "adjustment") {
        const meta =
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        if (meta.via === "grant_credits_admin" || meta.via === "grant_credits") {
          return sum + amount;
        }
      }
      return sum;
    },
    0,
  );
}

export function computeUsedThisPeriod(input: {
  available: number;
  planAllowance: number;
  bonusActive: number;
  ledgerUsed: number;
}): number {
  if (input.ledgerUsed > 0) return roundCredit(input.ledgerUsed);
  const implied = input.planAllowance + input.bonusActive - input.available;
  return roundCredit(Math.max(0, implied));
}

export function buildCanonicalBucket(input: {
  available: number;
  planAllowance: number;
  explicitBonus?: number;
  ledgerUsed?: number;
  reserved?: number;
  resetDate?: string | null;
}): CanonicalCreditBucket {
  const planAllowance = input.planAllowance;
  const bonusActive = computeActiveBonus(input.available, planAllowance, input.explicitBonus ?? 0);
  const normalized = normalizeAvailableCredits({
    rawAvailable: input.available,
    planAllowance,
    explicitBonus: bonusActive,
    ledgerUsed: input.ledgerUsed ?? 0,
  });
  const available = normalized.available;
  const usedThisPeriod = computeUsedThisPeriod({
    available,
    planAllowance,
    bonusActive,
    ledgerUsed: input.ledgerUsed ?? 0,
  });

  return {
    available,
    planAllowance,
    usedThisPeriod,
    bonusActive,
    bonusLabel: bonusActive > 0 ? "top-up" : null,
    bonusExpiresAt: null,
    resetDate: input.resetDate ?? null,
    reserved: roundCredit(Math.max(0, input.reserved ?? 0)),
    source: CANONICAL_CREDIT_SOURCE,
  };
}

async function readActionBalance(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  planAllowance: number,
): Promise<number> {
  const { data: existing } = await admin
    .from("action_credit_balances" as never)
    .select("balance")
    .eq("owner_user_id" as never, userId)
    .is("project_id" as never, null)
    .maybeSingle();

  const row = existing as { balance?: number } | null;
  if (row && typeof row.balance === "number") {
    return Number(row.balance);
  }
  return planAllowance;
}

export async function loadCanonicalCredits(
  input: LoadCanonicalCreditsOptions,
): Promise<CanonicalCreditsPayload> {
  const admin = createSupabaseAdmin();
  const planId = normalizePlanId(input.planId ?? "free") as PlanId;
  const buildPlanAllowance = monthlyTokensForPlan(planId);
  const actionPlanAllowance = monthlyActionCreditsForPlan(planId);
  const skipLedger = input.skipLedger !== false;

  let buildAvailable = input.buildAvailable;
  let resetDate = input.creditsResetAt ?? null;

  if (buildAvailable == null) {
    const { data: profile } = await admin
      .from("profiles")
      .select("credits_remaining, credits_reset_at, plan_id")
      .eq("id", input.userId)
      .maybeSingle();

    if (profile) {
      buildAvailable =
        typeof profile.credits_remaining === "number" ? profile.credits_remaining : buildPlanAllowance;
      resetDate = profile.credits_reset_at ?? resetDate;
    } else {
      buildAvailable = buildPlanAllowance;
    }
  }

  let buildLedgerUsed = 0;
  let buildReserved = 0;
  let actionLedgerUsed = 0;
  const explicitBuildBonus = await sumExplicitBuildGrants(admin, input.userId);

  const buildCap = creditCap(buildPlanAllowance, explicitBuildBonus);
  const rawBuildAvailable = buildAvailable ?? buildPlanAllowance;
  const buildLooksInflated = rawBuildAvailable > buildCap + 0.01;
  const shouldLoadLedger = !skipLedger || buildLooksInflated;

  if (shouldLoadLedger) {
    const periodStart = resetDate
      ? new Date(resetDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [buildUsageRes, buildReservedRes, actionUsageRes] = await Promise.all([
      admin
        .from("credit_events")
        .select("credits_consumed")
        .eq("user_id", input.userId)
        .eq("event_type", "generation")
        .gte("created_at", periodStart.toISOString()),
      admin
        .from("credit_reservations" as never)
        .select("reserved_user_credits")
        .eq("user_id" as never, input.userId)
        .eq("status" as never, "reserved"),
      admin
        .from("action_credit_events" as never)
        .select("action_credits_charged")
        .eq("owner_user_id" as never, input.userId)
        .is("project_id" as never, null)
        .gte("created_at" as never, periodStart.toISOString()),
    ]);

    buildLedgerUsed =
      (buildUsageRes.data ?? []).reduce(
        (sum, row) => sum + (Number((row as { credits_consumed?: number }).credits_consumed) || 0),
        0,
      ) ?? 0;

    buildReserved =
      (buildReservedRes.data ?? []).reduce(
        (sum, row) => sum + (Number((row as { reserved_user_credits?: number }).reserved_user_credits) || 0),
        0,
      ) ?? 0;

    actionLedgerUsed =
      (actionUsageRes.data ?? []).reduce((sum, row) => {
        const charged = Number((row as { action_credits_charged?: number }).action_credits_charged) || 0;
        return charged > 0 ? sum + charged : sum;
      }, 0) ?? 0;
  }

  const buildNorm = normalizeAvailableCredits({
    rawAvailable: rawBuildAvailable,
    planAllowance: buildPlanAllowance,
    explicitBonus: explicitBuildBonus,
    ledgerUsed: buildLedgerUsed,
  });

  const skipInflationRepair = isE2eCreditTestAccount(input.email);

  if (buildNorm.inflated && buildAvailable != null && !skipInflationRepair) {
    try {
      await repairProfileCreditsIfInflated(admin, input.userId, buildNorm.available);
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[credits] Repaired inflated balance for ${input.userId}: ${buildNorm.correctedFrom} → ${buildNorm.available}`,
        );
      }
    } catch {
      /* display still clamped even if persist fails */
    }
  }

  const actionAvailableRaw =
    input.actionAvailable != null
      ? input.actionAvailable
      : await readActionBalance(admin, input.userId, actionPlanAllowance);

  const actionNorm = normalizeAvailableCredits({
    rawAvailable: actionAvailableRaw,
    planAllowance: actionPlanAllowance,
    explicitBonus: 0,
    ledgerUsed: actionLedgerUsed,
  });

  const actionAvailable = actionNorm.available;

  const build = buildCanonicalBucket({
    available: buildNorm.available,
    planAllowance: buildPlanAllowance,
    explicitBonus: explicitBuildBonus,
    ledgerUsed: buildLedgerUsed,
    reserved: buildReserved,
    resetDate,
  });

  const action = buildCanonicalBucket({
    available: actionAvailable,
    planAllowance: actionPlanAllowance,
    explicitBonus: 0,
    ledgerUsed: actionLedgerUsed,
    resetDate,
  });

  return { build, action, planId };
}

/** Serialize for GET /api/credits with backward-compatible flat fields. */
export function serializeCanonicalCredits(payload: CanonicalCreditsPayload) {
  return {
    build: payload.build,
    action: payload.action,
    plan_id: payload.planId,
    // Legacy flat fields — prefer build/action objects in new UI
    remaining: payload.build.available,
    balance: payload.build.available,
    available: payload.build.available,
    quota: payload.build.planAllowance,
    plan_allowance: payload.build.planAllowance,
    bonus_credits: payload.build.bonusActive,
    used_this_period: payload.build.usedThisPeriod,
    reserved: payload.build.reserved,
    reset_at: payload.build.resetDate,
    action_credits_remaining: payload.action.available,
    action_credits_plan_allowance: payload.action.planAllowance,
    action_credits_bonus: payload.action.bonusActive,
    action_used_this_period: payload.action.usedThisPeriod,
  };
}

/** Admin list row fields derived from canonical payload. */
export function adminFieldsFromCanonical(payload: CanonicalCreditsPayload) {
  return {
    tokens_remaining: payload.build.available,
    monthly_token_limit: payload.build.planAllowance,
    bonus_credits: payload.build.bonusActive,
    used_this_period: payload.build.usedThisPeriod,
    reserved_credits: payload.build.reserved,
    action_credits_remaining: payload.action.available,
    action_credits_plan_allowance: payload.action.planAllowance,
    action_credits_bonus: payload.action.bonusActive,
    is_test_or_grant_account: payload.build.bonusActive > 0 || payload.action.bonusActive > 0,
  };
}
