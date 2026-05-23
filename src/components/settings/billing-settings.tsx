"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  ArrowRight,
  Zap,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  PLAN_DISPLAY,
  STRIPE_CHECKOUT_PLANS,
  type StripeCheckoutPlan,
} from "@/lib/billing/plans";

type BillingState = {
  planId: string;
  plan: { name: string; priceMonthlyUsd: number | null; description: string };
  tokensRemaining: number;
  monthlyTokens: number;
  resetAt: string | null;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    pendingDowngradePlan: string | null;
  } | null;
  stripe: { configured: boolean; missingEnv: string[] };
};

export function BillingSettings() {
  const { profile } = useAuthStore();
  const { remaining, resetAt, syncFromDB } = useCreditsStore();
  const [billing, setBilling] = React.useState<BillingState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkoutPlan, setCheckoutPlan] = React.useState<StripeCheckoutPlan | null>(null);
  const [downgradePlan, setDowngradePlan] = React.useState<StripeCheckoutPlan | "free" | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  const loadBilling = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/billing/subscription");
    const json = (await res.json()) as BillingState & { error?: string };
    if (res.ok) setBilling(json);
    else setBilling(null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadBilling();
    if (profile?.id) void syncFromDB(profile.id);
  }, [loadBilling, syncFromDB, profile?.id]);

  async function startCheckout(plan: StripeCheckoutPlan) {
    if (!checkoutPlan) {
      setCheckoutPlan(plan);
      return;
    }
    setActing(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan, confirmed: true }),
    });
    const json = (await res.json()) as { url?: string; error?: string; missingEnv?: string[] };
    setActing(false);
    if (!res.ok) {
      toast.error(json.error ?? "Checkout unavailable");
      if (json.missingEnv?.length) {
        toast.info(`Missing: ${json.missingEnv.join(", ")}`);
      }
      return;
    }
    if (json.url) window.location.href = json.url;
  }

  async function scheduleDowngrade(plan: StripeCheckoutPlan | "free") {
    if (downgradePlan !== plan) {
      setDowngradePlan(plan);
      return;
    }
    setActing(true);
    const res = await fetch("/api/billing/downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan, confirmed: true }),
    });
    const json = (await res.json()) as { message?: string; error?: string };
    setActing(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not schedule downgrade");
      return;
    }
    toast.success(json.message ?? "Downgrade scheduled");
    setDowngradePlan(null);
    void loadBilling();
  }

  async function cancelRenewal() {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setActing(true);
    const res = await fetch("/api/billing/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    const json = (await res.json()) as { message?: string; error?: string };
    setActing(false);
    if (!res.ok) {
      toast.error(json.error ?? "Cancel failed");
      return;
    }
    toast.success(json.message ?? "Renewal canceled");
    setShowCancelConfirm(false);
    void loadBilling();
  }

  async function openPortal() {
    setActing(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const json = (await res.json()) as { url?: string; error?: string };
    setActing(false);
    if (!res.ok) {
      toast.error(json.error ?? "Portal unavailable");
      return;
    }
    if (json.url) window.location.href = json.url;
  }

  const planId = billing?.planId ?? profile?.plan_id ?? "free";
  const planInfo = PLAN_DISPLAY[planId as keyof typeof PLAN_DISPLAY] ?? PLAN_DISPLAY.free;
  const isPaid = planId !== "free";
  const stripeReady = billing?.stripe.configured ?? false;

  const daysUntilReset = (billing?.resetAt ?? resetAt)
    ? Math.max(0, Math.ceil((new Date(billing?.resetAt ?? resetAt!).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <motion.div variants={variants.staggerContainer} initial="hidden" animate="show" className="dashboard-shell space-y-6 overflow-x-hidden">
      {!stripeReady && !loading && (
        <motion.div
          variants={variants.fadeUp}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px]"
        >
          <p className="font-medium text-foreground">Stripe setup required</p>
          <p className="mt-1 text-muted-foreground">
            Paid upgrades need server env vars (names only):{" "}
            {(billing?.stripe.missingEnv ?? []).join(", ") || "STRIPE_SECRET_KEY, STRIPE_*_PRICE_ID, STRIPE_WEBHOOK_SECRET"}
          </p>
        </motion.div>
      )}

      <motion.div variants={variants.fadeUp}>
        <div className="rounded-[var(--radius-xl)] bg-background ring-1 ring-border overflow-hidden">
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                      Current plan
                    </p>
                    <h2 className="text-[24px] font-bold tracking-tight">{planInfo.name}</h2>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {planInfo.priceMonthlyUsd != null ? `$${planInfo.priceMonthlyUsd} / month` : "Custom pricing"} ·{" "}
                      {planInfo.description.replace(/credits/gi, "tokens")}
                    </p>
                    {billing?.subscription?.cancelAtPeriodEnd && billing.subscription.currentPeriodEnd && (
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-600">
                        <AlertTriangle className="size-3.5" />
                        Cancels on {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                    {billing?.subscription?.pendingDowngradePlan && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Downgrade to {billing.subscription.pendingDowngradePlan} starts next billing cycle.
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1",
                      isPaid ? "text-accent bg-accent/10 ring-accent/20" : "text-muted-foreground bg-muted/60 ring-border",
                    )}
                  >
                    {billing?.subscription?.status ?? (isPaid ? "active" : "free")}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <motion.div className="rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="size-3.5 text-accent" />
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">Tokens left</p>
                    </div>
                    <p className="text-[22px] font-bold tabular-nums">{(billing?.tokensRemaining ?? remaining).toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(billing?.monthlyTokens ?? 100).toLocaleString()} / month
                    </p>
                  </motion.div>
                  <div className="rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="size-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">Renews in</p>
                    </div>
                    <p className="text-[22px] font-bold">{daysUntilReset != null ? `${daysUntilReset}d` : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-surface px-4 py-3 ring-1 ring-border">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="size-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">Billing</p>
                    </div>
                    <p className="text-[22px] font-bold">{stripeReady ? "Stripe" : "Not configured"}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border bg-surface/50 px-6 py-4 space-y-4">
            <p className="text-[13px] font-medium text-foreground">Upgrade</p>
            <p className="text-[12px] text-muted-foreground">
              Upgrades open Stripe Checkout after you confirm price and tokens. Your new billing period starts when payment
              succeeds.
            </p>
            <div className="flex flex-wrap gap-2">
              {STRIPE_CHECKOUT_PLANS.map((p) => (
                <Button
                  key={p}
                  variant={checkoutPlan === p ? "accent" : "outline"}
                  size="sm"
                  disabled={!stripeReady || acting || planId === p}
                  onClick={() => void startCheckout(p)}
                >
                  {checkoutPlan === p ? (
                    <>
                      <CheckCircle2 className="mr-1 size-3.5" /> Confirm → Stripe
                    </>
                  ) : (
                    <>
                      {PLAN_DISPLAY[p].name} · ${PLAN_DISPLAY[p].priceMonthlyUsd}/mo
                    </>
                  )}
                </Button>
              ))}
            </div>
            {isPaid && (
              <>
                <p className="text-[13px] font-medium pt-2">Downgrade or cancel</p>
                <p className="text-[12px] text-muted-foreground">
                  Downgrades keep your current plan until period end. Cancel stops renewal but paid access continues until{" "}
                  {billing?.subscription?.currentPeriodEnd
                    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()
                    : "period end"}
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting}
                    onClick={() => void scheduleDowngrade("starter")}
                  >
                    {downgradePlan === "starter" ? "Confirm downgrade to Starter" : "Downgrade to Starter"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={acting} onClick={() => void scheduleDowngrade("free")}>
                    {downgradePlan === "free" ? "Confirm downgrade to Free (next cycle)" : "Downgrade to Free"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={acting}
                    onClick={() => void cancelRenewal()}
                  >
                    {showCancelConfirm ? "Confirm cancel renewal" : "Cancel renewal"}
                  </Button>
                </div>
              </>
            )}

            {isPaid && stripeReady && (
              <Button variant="secondary" size="sm" disabled={acting} onClick={() => void openPortal()}>
                <CreditCard className="mr-1.5 size-3.5" />
                Open Stripe billing portal
                <ArrowRight className="ml-1 size-3" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
