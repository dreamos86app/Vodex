"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
import type { BillablePlanId } from "@/lib/billing/billable-plans";

export type PaddleCheckoutPlan = BillablePlanId;

type PaddleStatusResponse = {
  configured?: boolean;
  publicCheckoutEnabled?: boolean;
  envConsistencyOk?: boolean;
  envErrors?: string[];
};

export type PaddleBillingActionResponse = {
  url?: string;
  transactionId?: string;
  billingAttemptId?: string;
  mode?: string;
  error?: string;
  code?: string;
  message?: string;
  webhookRequired?: boolean;
  planChange?: {
    action?: string;
    legacyAction?: string;
    description?: string;
    apiRoute?: string | null;
    hasActiveSubscription?: boolean;
  };
  failureReasons?: string[];
  missingEnv?: string[];
};

export function usePaddleBillingReady() {
  const [configured, setConfigured] = React.useState(false);
  const [publicCheckoutEnabled, setPublicCheckoutEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void fetch("/api/billing/paddle/status", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json()) as PaddleStatusResponse;
        setConfigured(Boolean(json.configured && json.envConsistencyOk !== false));
        setPublicCheckoutEnabled(Boolean(json.publicCheckoutEnabled));
      })
      .catch(() => {
        setConfigured(false);
        setPublicCheckoutEnabled(false);
      })
      .finally(() => setLoading(false));
  }, []);

  return { configured, publicCheckoutEnabled, loading };
}

export function usePaddleCheckout() {
  const [busy, setBusy] = React.useState(false);

  async function startCheckout(
    plan: PaddleCheckoutPlan,
    annual: boolean,
    options?: { source?: "pricing" | "settings" },
  ): Promise<PaddleBillingActionResponse | null> {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/paddle/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan,
          interval: annual ? "annual" : "monthly",
          confirmed: true,
          source: options?.source ?? "pricing",
        }),
      });
      const json = (await res.json()) as PaddleBillingActionResponse;
      if (!res.ok) {
        if (json.code === "public_checkout_disabled") {
          toast.error(
            json.error ?? "Billing is being activated. Owner test checkout is available for admins.",
          );
        } else {
          const detail = [
            json.error ?? "Billing could not start",
            json.planChange?.description,
            ...(json.failureReasons ?? []),
            json.missingEnv?.length ? `Missing: ${json.missingEnv.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          pushRuntimeDiagnostic("charge_failed", {
            reason: "paddle_checkout_failed",
            plan,
            annual,
            error: json.error,
            code: json.code,
          });
          toast.error(json.error ?? "Billing could not start");
          return null;
        }
        return null;
      }

      if (json.billingAttemptId) {
        pushRuntimeDiagnostic("charge_started", {
          billingAttemptId: json.billingAttemptId,
          plan,
          annual,
          source: "pricing",
        });
      }

      if (json.mode === "paddle_subscription_update") {
        if (json.billingAttemptId && typeof window !== "undefined") {
          window.location.href = `/settings/billing?paddle=success&attemptId=${encodeURIComponent(json.billingAttemptId)}`;
          return json;
        }
        toast.info(
          json.message ??
            "Subscription updated in Paddle. Open Settings → Billing to track webhook confirmation.",
        );
        return json;
      }

      if (json.mode === "scheduled_downgrade") {
        toast.success(json.message ?? "Downgrade scheduled for end of billing period.");
        return json;
      }

      if (json.url) {
        window.location.href = json.url;
        return json;
      }

      throw new Error("No checkout URL returned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { startCheckout, busy };
}
