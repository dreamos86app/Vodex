import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  grossMarginFromCharge,
  revenueMultiplierFromCharge,
  userCreditsToRevenueUsd,
} from "@/lib/billing/pricing-config";

function rangeToSince(range: string): string {
  const ms =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "30d"
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

export async function GET(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "7d";
  const operationType = url.searchParams.get("operationType");
  const lowMarginOnly = url.searchParams.get("lowMarginOnly") === "1";
  const failedOnly = url.searchParams.get("failedOnly") === "1";
  const since = rangeToSince(range);

  let auditQuery = admin
    .from("generation_cost_audits" as "ai_usage_logs")
    .select(
      "quoted_user_credits, internal_cost_credits, gross_margin_estimate, reserved_user_credits, final_user_credits, status, provider_cost_usd, mode, metadata, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: auditsRaw } = await auditQuery;
  let rows = (auditsRaw ?? []) as Array<{
    quoted_user_credits?: number;
    internal_cost_credits?: number;
    gross_margin_estimate?: number;
    reserved_user_credits?: number;
    final_user_credits?: number | null;
    status?: string;
    provider_cost_usd?: number;
    mode?: string;
    metadata?: Record<string, unknown>;
    created_at?: string;
  }>;

  if (failedOnly) {
    rows = rows.filter((r) => ["failed", "refunded"].includes(r.status ?? ""));
  }

  const filtered = rows.filter((r) => {
    const op = (r.metadata?.operation_type as string) ?? r.mode ?? "unknown";
    if (operationType && op !== operationType && r.mode !== operationType) return false;
    const final = r.final_user_credits ?? r.quoted_user_credits ?? 0;
    const providerUsd = Number(r.provider_cost_usd ?? 0);
    const margin = grossMarginFromCharge(final, providerUsd);
    if (lowMarginOnly && margin >= 0.5) return false;
    return true;
  });

  let totalUser = 0;
  let totalInternal = 0;
  let totalProvider = 0;
  let refunded = 0;
  let multiplierSum = 0;
  let marginSum = 0;
  let count = 0;
  const byOperation: Record<string, number> = {};

  for (const r of filtered) {
    const final = r.final_user_credits ?? r.quoted_user_credits ?? 0;
    const providerUsd = Number(r.provider_cost_usd ?? 0);
    const op = (r.metadata?.operation_type as string) ?? r.mode ?? "other";
    byOperation[op] = (byOperation[op] ?? 0) + final;
    totalUser += final;
    totalInternal += r.internal_cost_credits ?? 0;
    totalProvider += providerUsd;
    if (r.status === "refunded") refunded += r.reserved_user_credits ?? 0;
    if (final > 0 && providerUsd > 0) {
      multiplierSum += revenueMultiplierFromCharge(final, providerUsd);
      marginSum += grossMarginFromCharge(final, providerUsd);
      count += 1;
    }
  }

  const { data: usage } = await admin
    .from("provider_usage_logs" as "ai_usage_logs")
    .select("operation_type, provider, metadata, provider_cost_usd")
    .gte("created_at", since)
    .limit(300);

  const usageRows = (usage ?? []) as Array<{
    operation_type?: string;
    metadata?: { cache_hit?: boolean };
  }>;
  const cacheHits = usageRows.filter((u) => u.metadata?.cache_hit).length;
  const cacheHitRate = usageRows.length > 0 ? cacheHits / usageRows.length : 0;

  const events = filtered.slice(0, 40).map((r) => {
    const final = r.final_user_credits ?? r.quoted_user_credits ?? 0;
    const providerUsd = Number(r.provider_cost_usd ?? 0);
    return {
      operationType: (r.metadata?.operation_type as string) ?? r.mode,
      revenueCredits: final,
      revenueUsd: userCreditsToRevenueUsd(final),
      providerCostUsd: providerUsd,
      internalCostCredits: r.internal_cost_credits,
      revenueMultiplier: revenueMultiplierFromCharge(final, providerUsd),
      grossMargin: grossMarginFromCharge(final, providerUsd),
      status: r.status,
      reserved: r.reserved_user_credits,
      refunded: r.status === "refunded",
      at: r.created_at,
    };
  });

  const { data: usageFailedRaw } = await admin
    .from("ai_usage_logs")
    .select("operation_id, user_email, model_id, mode, tokens_charged, status, error_message, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const failedCharges = ((usageFailedRaw ?? []) as Array<Record<string, unknown>>)
    .filter((r) => ["charge_failed", "error", "failed"].includes(String(r.status ?? "")))
    .slice(0, 50)
    .map((r) => ({
      operationId: r.operation_id as string | undefined,
      userEmail: r.user_email as string | undefined,
      model: r.model_id as string | undefined,
      mode: r.mode as string | undefined,
      creditsConsumed: Number(r.tokens_charged ?? 0),
      providerCostUsd: 0,
      status: String(r.status ?? ""),
      error: r.error_message as string | undefined,
      at: r.created_at as string | undefined,
    }));

  const totalRequests = filtered.length + failedCharges.length;
  const failedChargeCount = failedCharges.length;

  return NextResponse.json({
    range,
    totalRequests,
    failedChargeCount,
    totalUserCreditsCharged: totalUser,
    totalRevenueUsd: Math.round(userCreditsToRevenueUsd(totalUser) * 100) / 100,
    totalInternalCostCredits: totalInternal,
    providerSpendUsd: Math.round(totalProvider * 10000) / 10000,
    avgRevenueMultiplier: count > 0 ? multiplierSum / count : 3,
    avgGrossMargin: count > 0 ? marginSum / count : 2 / 3,
    reservedCredits: filtered.reduce((s, r) => s + (r.reserved_user_credits ?? 0), 0),
    refundedCredits: refunded,
    overageAbsorbed: 0,
    cacheHitRate,
    estimatedTokensSaved: Math.round(cacheHits * 1200),
    byOperation,
    events,
    failedCharges,
    sampleSize: filtered.length,
    filters: { operationType, lowMarginOnly, failedOnly },
  });
}
