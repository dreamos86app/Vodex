import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { missingStripeEnvVars } from "@/lib/billing/plans";
import { fetchSubscriptions, parseAdminPagination } from "@/lib/admin/admin-query-compat";

function maskId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { limit, offset } = parseAdminPagination(new URL(req.url).searchParams);

  try {
    const admin = createSupabaseAdmin();

    const { rows: subscriptions, error } = await fetchSubscriptions(admin, { limit, offset });

    if (error) {
      return NextResponse.json(
        {
          error,
          subscriptions: [],
          hint: "Run scripts/admin-column-compat.sql then NOTIFY pgrst, 'reload schema';",
        },
        { status: 500 },
      );
    }

    const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id,email,plan_id").in("id", userIds)
      : { data: [] };

    const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    const { data: failedEvents } = await admin
      .from("billing_events")
      .select("id,user_id,event_type,amount_usd,created_at,stripe_event_id")
      .eq("event_type", "invoice.payment_failed")
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = subscriptions.map((s) => ({
      ...s,
      user_email: emailById.get(s.user_id) ?? null,
      stripe_subscription_id_masked: maskId(s.stripe_subscription_id),
      stripe_customer_id_masked: maskId(s.stripe_customer_id),
    }));

    return NextResponse.json({
      subscriptions: rows,
      limit,
      offset,
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
