import "server-only";

import { buildAllPaymentReadiness } from "@/lib/generated-app-payments/payment-readiness";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

export async function runPaymentCertificationChecks(
  ctx: CertificationContext,
): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];
  const readiness = await buildAllPaymentReadiness(ctx.projectId);

  let anyConnected = false;
  let paymentScore = 0;
  let paymentWeight = 0;

  for (const card of readiness) {
    const w = 4;
    paymentWeight += w;
    const connected = card.mode !== "not_connected";
    if (connected) anyConnected = true;

    let status: "passed" | "warning" | "blocker" = "passed";
    if (card.mode === "mock") status = "passed";
    else if (card.mode === "not_connected") status = "warning";
    else if (!card.canTestPayment && card.missingFields.length) status = "warning";
    else if (card.checkoutStatus === "live_ready" || card.checkoutStatus === "sandbox_ready")
      status = "passed";
    else status = "warning";

    if (status === "passed") paymentScore += w;
    else if (status === "warning") paymentScore += w * 0.5;

    if (connected || card.mode === "sandbox" || card.mode === "live") {
      checks.push({
        id: `payment_${card.provider}`,
        section: "payments",
        title: `${card.provider} (${card.mode})`,
        status,
        weight: w,
        detail: card.message,
        fix:
          card.missingFields.length > 0
            ? `Add: ${card.missingFields.join(", ")}`
            : card.webhookStatus === "not_configured"
              ? "Configure webhook secret for revenue analytics."
              : undefined,
      });
    }
  }

  const avg = paymentWeight ? Math.round((paymentScore / paymentWeight) * 100) : 0;
  checks.push({
    id: "payment_readiness_score",
    section: "payments",
    title: "Payment readiness score",
    status: anyConnected ? (avg >= 70 ? "passed" : "warning") : "warning",
    weight: 6,
    detail: anyConnected
      ? `Weighted payment readiness: ${avg}/100.`
      : "No payment provider connected — optional unless you charge customers.",
    fix: anyConnected ? undefined : "Connect Stripe sandbox or mark payments as not required.",
  });

  return checks;
}
