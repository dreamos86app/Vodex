import { NextResponse } from "next/server";
import { verifyPaddleWebhookSignature } from "@/lib/billing/paddle-api";
import { storePaddleWebhookEvent } from "@/lib/billing/paddle-event-store";
import { paddleEnvironment } from "@/lib/billing/paddle-billing";
import { processPaddleWebhookPayload } from "@/lib/billing/paddle-webhook-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Paddle webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");

  if (!verifyPaddleWebhookSignature(rawBody, signature, secret)) {
    const eventId = `paddle:invalid:${Date.now()}`;
    await storePaddleWebhookEvent({
      paddleEventId: eventId,
      eventType: "signature_invalid",
      environment: paddleEnvironment(),
      isSimulation: false,
      userId: null,
      workspaceId: null,
      paddleCustomerId: null,
      paddleSubscriptionId: null,
      paddleTransactionId: null,
      paddlePriceId: null,
      plan: null,
      interval: null,
      processingStatus: "signature_invalid",
      error: "Invalid Paddle-Signature",
      payloadSafe: {},
    }).catch(() => undefined);

    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: { event_type?: string; event_id?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.event_type ?? "";
  const eventId = payload.event_id ?? `paddle:${Date.now()}`;
  const data = payload.data ?? {};

  const result = await processPaddleWebhookPayload({ eventType, eventId, data });

  return NextResponse.json({
    received: result.received,
    eventId: result.eventId,
    eventType: result.eventType,
    processingStatus: result.processingStatus,
    duplicate: result.duplicate,
  });
}
