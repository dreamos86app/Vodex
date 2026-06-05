import "server-only";

import type { PaymentProviderId } from "@/lib/generated-app-payments/types";
import { listPaymentConnections, getDecryptedSecrets } from "@/lib/generated-app-payments/connection-store";
import { verifyPaymentProviderConfig } from "@/lib/generated-app-payments/verify-provider";

export type PaymentReadinessMode = "not_connected" | "mock" | "sandbox" | "live";

export type PaymentReadinessCard = {
  provider: PaymentProviderId;
  mode: PaymentReadinessMode;
  status: string;
  requiredFields: string[];
  missingFields: string[];
  webhookStatus: "not_configured" | "configured" | "verified" | "unverified";
  checkoutStatus: "not_ready" | "sandbox_ready" | "live_ready" | "mock_preview";
  revenueAnalytics: "unavailable" | "sandbox" | "live" | "mock";
  message: string;
  canTestPayment: boolean;
};

const REQUIRED: Record<PaymentProviderId, string[]> = {
  stripe: ["secret_key", "publishable_key"],
  paypal: ["client_id", "client_secret"],
  paddle: ["api_key"],
  lemon_squeezy: ["api_key", "store_id"],
  revenuecat: ["api_key"],
};

function toReadinessMode(
  status: string,
  connectionMode: string,
  hasSecrets: boolean,
): PaymentReadinessMode {
  if (!hasSecrets || status === "disconnected") return "not_connected";
  if (connectionMode === "mock") return "mock";
  if (connectionMode === "live" || connectionMode === "production") return "live";
  return "sandbox";
}

export async function buildPaymentReadiness(
  projectId: string,
  provider: PaymentProviderId,
): Promise<PaymentReadinessCard> {
  const rows = await listPaymentConnections(projectId);
  const row = rows.find((r) => r.provider === provider);
  const secrets = await getDecryptedSecrets(projectId, provider);
  const hasSecrets = Object.values(secrets).some((v) => Boolean(v?.trim()));
  const mode = toReadinessMode(row?.status ?? "disconnected", row?.mode ?? "test", hasSecrets);
  const required = REQUIRED[provider] ?? ["api_key"];
  const missing = required.filter((k) => !secrets[k as keyof typeof secrets]?.trim());

  const webhookSecret = secrets.webhook_secret?.trim();
  const webhookStatus = !webhookSecret
    ? "not_configured"
    : row?.status === "webhook_verified"
      ? "verified"
      : "configured";

  let message = "";
  let canTestPayment = false;
  let checkoutStatus: PaymentReadinessCard["checkoutStatus"] = "not_ready";
  let revenueAnalytics: PaymentReadinessCard["revenueAnalytics"] = "unavailable";

  if (mode === "not_connected") {
    message = "Not connected — use sandbox test keys or enable mock preview.";
  } else if (mode === "mock") {
    message = "Mock preview — UI only, no live charges.";
    checkoutStatus = "mock_preview";
    revenueAnalytics = "mock";
  } else if (missing.length) {
    message = `Missing: ${missing.join(", ")}`;
  } else if (mode === "sandbox") {
    try {
      const verify = await verifyPaymentProviderConfig(projectId, provider);
      message = verify.message;
      canTestPayment = verify.ok;
      checkoutStatus = verify.ok ? "sandbox_ready" : "not_ready";
      revenueAnalytics = verify.ok ? "sandbox" : "unavailable";
    } catch {
      message = "Sandbox verification unavailable — check credentials.";
    }
  } else {
    try {
      const verify = await verifyPaymentProviderConfig(projectId, provider);
      message = verify.message;
      canTestPayment = verify.ok;
      checkoutStatus = verify.ok ? "live_ready" : "not_ready";
      revenueAnalytics = verify.ok ? "live" : "unavailable";
    } catch {
      message = "Live verification unavailable — check credentials.";
    }
  }

  return {
    provider,
    mode,
    status: row?.status ?? "disconnected",
    requiredFields: required,
    missingFields: missing,
    webhookStatus,
    checkoutStatus,
    revenueAnalytics,
    message,
    canTestPayment,
  };
}

export async function buildAllPaymentReadiness(projectId: string): Promise<PaymentReadinessCard[]> {
  const providers: PaymentProviderId[] = [
    "stripe",
    "paypal",
    "paddle",
    "lemon_squeezy",
    "revenuecat",
  ];
  return Promise.all(providers.map((p) => buildPaymentReadiness(projectId, p)));
}
