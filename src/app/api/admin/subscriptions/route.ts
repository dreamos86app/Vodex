import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { missingStripeEnvVars } from "@/lib/billing/plans";

function maskId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  try {
    const admin = createSupabaseAdmin();

    const { data: subscriptions, error } = await admin
      .from("subscriptions")
      .select(
        "id,user_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_downgrade_plan,stripe_subscription_id,stripe_customer_id,stripe_price_id,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message, subscriptions: [] }, { status: 500 });
    }

    const userIds = [...new Set((subscriptions ?? []).map((s) => s.user_id))];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id,email,plan_id").in("id", userIds)
      : { data: [] };

    const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    const { data: failedEvents } = await admin
      .from("billing_events")
      .select("id,user_id,event_type,amount_usd,created_at,stripe_event_id")
      .in("event_type", ["invoice.payment_failed", "invoice.payment_failed"])
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (subscriptions ?? []).map((s) => ({
      ...s,
      user_email: emailById.get(s.user_id) ?? null,
      stripe_subscription_id_masked: maskId(s.stripe_subscription_id),
      stripe_customer_id_masked: maskId(s.stripe_customer_id),
    }));

    return NextResponse.json({
      subscriptions: rows,
      failedPayments: failedEvents ?? [],
      stripe: {
        configured: missingStripeEnvVars().length === 0,
        missingEnv: missingStripeEnvVars(),
        webhookPath: "/api/billing/webhook",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg, subscriptions: [] }, { status: 503 });
  }
}
