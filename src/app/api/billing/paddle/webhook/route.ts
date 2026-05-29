import { NextResponse } from "next/server";
import { verifyPaddleWebhookSignature } from "@/lib/billing/paddle-api";
import {
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
} from "@/lib/billing/paddle-webhook-handlers";

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

  if (eventType === "transaction.completed") {
    await handlePaddleTransactionCompleted({
      data,
      paddleEventId: eventId,
    });
  }

  if (eventType.startsWith("subscription.")) {
    await handlePaddleSubscriptionEvent({
      eventType,
      data,
      paddleEventId: eventId,
    });
  }

  return NextResponse.json({ received: true });
}
