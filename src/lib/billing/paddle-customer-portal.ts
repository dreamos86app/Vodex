import { paddleEnvironment } from "@/lib/billing/paddle-billing";

function paddleApiBase(): string {
  return paddleEnvironment() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export type PaddleCustomerPortalResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; code: "missing_customer" | "setup_required" | "api_error"; error: string };

/**
 * Creates an authenticated Paddle Customer Portal session (no generic signup page).
 * Requires API key permission: customer_portal_session.write
 */
export async function createPaddleCustomerPortalSession(input: {
  paddleCustomerId: string;
  paddleSubscriptionId?: string | null;
}): Promise<PaddleCustomerPortalResult> {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "setup_required", error: "Paddle API key is not configured." };
  }

  const customerId = input.paddleCustomerId.trim();
  if (!customerId || !customerId.startsWith("ctm_")) {
    return {
      ok: false,
      code: "missing_customer",
      error:
        "No Paddle customer is linked to this account yet. Complete checkout first or contact support.",
    };
  }

  const body: { subscription_ids?: string[] } = {};
  if (input.paddleSubscriptionId?.startsWith("sub_")) {
    body.subscription_ids = [input.paddleSubscriptionId];
  }

  try {
    const res = await fetch(`${paddleApiBase()}/customers/${customerId}/portal-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: {
        id?: string;
        urls?: { general?: { overview?: string } };
      };
      error?: { detail?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        code: "api_error",
        error: json.error?.detail ?? `Paddle portal API ${res.status}`,
      };
    }

    const url = json.data?.urls?.general?.overview;
    if (!url) {
      return { ok: false, code: "api_error", error: "Paddle did not return a portal URL." };
    }

    return { ok: true, url, sessionId: json.data?.id ?? "unknown" };
  } catch (e) {
    return {
      ok: false,
      code: "api_error",
      error: e instanceof Error ? e.message : "Paddle portal request failed",
    };
  }
}

/** True when stored value looks like a Paddle customer id (not legacy placeholders). */
export function isPaddleCustomerId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith("ctm_"));
}
