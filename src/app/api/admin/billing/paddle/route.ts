import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import {
  buildPaddleAdminConfigStatus,
  type PaddleBillingEventRow,
} from "@/lib/billing/paddle-config-status";
import { verifyPaddleCatalogViaApi } from "@/lib/billing/paddle-api-verify";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";

function mapBillingEvents(
  rows: Array<{
    id: string;
    created_at: string;
    event_type: string;
    user_id: string | null;
    metadata: unknown;
  }> | null,
): PaddleBillingEventRow[] {
  return (rows ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      createdAt: row.created_at,
      eventType: row.event_type,
      userId: row.user_id,
      processingStatus: (meta.processing_status as string) ?? null,
      isSimulation: Boolean(meta.is_simulation),
      plan: (meta.plan as string) ?? null,
      paddlePriceId: (meta.paddle_price_id as string) ?? null,
    };
  });
}

export async function GET(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const url = new URL(request.url);
  const runVerify = url.searchParams.get("verify") === "1";

  const admin = createSupabaseAdmin();
  const { data: webhookEvents } = await admin
    .from("billing_events")
    .select("id, created_at, event_type, user_id, metadata")
    .like("event_type", "paddle.%")
    .order("created_at", { ascending: false })
    .limit(25);

  const { data: checkoutEvents } = await admin
    .from("billing_events")
    .select("id, created_at, event_type, user_id, metadata")
    .eq("event_type", "paddle.checkout.attempt")
    .order("created_at", { ascending: false })
    .limit(15);

  const apiVerify = runVerify ? await verifyPaddleCatalogViaApi() : null;

  return NextResponse.json(
    buildPaddleAdminConfigStatus(getAppUrl(), {
      recentEvents: mapBillingEvents(webhookEvents),
      recentCheckoutAttempts: mapBillingEvents(checkoutEvents),
      apiVerify: apiVerify
        ? {
            ok: apiVerify.ok,
            connectionOk: apiVerify.connectionOk,
            errors: apiVerify.errors,
            warnings: apiVerify.warnings,
          }
        : null,
    }),
  );
}
