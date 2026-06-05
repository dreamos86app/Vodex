import { NextResponse } from "next/server";
import { loadPublishedAppBySlug } from "@/lib/publish/published-app-runtime";
import { processPaymentWebhook } from "@/lib/generated-app-payments/webhook-processor";
import { insertAppPaymentEvent } from "@/lib/generated-app-payments/app-payment-events";
import { listPaymentConnections } from "@/lib/generated-app-payments/connection-store";
import type { PaymentProviderId } from "@/lib/generated-app-payments/types";

export const dynamic = "force-dynamic";

const VALID: PaymentProviderId[] = ["paddle", "stripe", "lemon_squeezy", "paypal", "revenuecat"];

function normalizeProvider(raw: string): PaymentProviderId | null {
  if (raw === "lemon-squeezy") return "lemon_squeezy";
  if (VALID.includes(raw as PaymentProviderId)) return raw as PaymentProviderId;
  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; provider: string }> },
) {
  const { slug: rawSlug, provider: providerRaw } = await ctx.params;
  const slug = rawSlug?.trim().toLowerCase();
  const provider = normalizeProvider(providerRaw);
  if (!slug || !provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const published = await loadPublishedAppBySlug(slug);
  if (!published) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const connections = await listPaymentConnections(published.project_id);
  const conn = connections.find((c) => c.provider === provider);
  if (!conn || conn.status === "not_connected" || conn.status === "disabled" || conn.status === "error") {
    return NextResponse.json({ error: "Provider not connected" }, { status: 403 });
  }

  const isMock =
    process.env.NODE_ENV === "development" &&
    req.headers.get("x-vodex-mock-webhook") === "1" &&
    conn.mode === "test";

  const rawBody = await req.text();

  if (isMock) {
    await insertAppPaymentEvent({
      projectId: published.project_id,
      ownerId: published.owner_id,
      publishedAppId: published.id,
      paymentProvider: provider,
      eventType: "mock_checkout_completed",
      amountCents: 0,
      currency: "usd",
      mode: "mock",
      meta: { slug, mock: true },
    });
    return NextResponse.json({ received: true, mode: "mock" });
  }

  const result = await processPaymentWebhook({
    provider,
    rawBody,
    headers: req.headers,
    projectIdHint: published.project_id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Webhook rejected" }, { status: 400 });
  }

  const paymentMode = conn.mode === "live" ? "live" : "sandbox";

  await insertAppPaymentEvent({
    projectId: published.project_id,
    ownerId: published.owner_id,
    publishedAppId: published.id,
    paymentProvider: provider,
    eventType: "webhook_received",
    mode: paymentMode,
    meta: { slug, processed: result.processed },
  });

  return NextResponse.json({ received: true, processed: result.processed, mode: paymentMode });
}
