"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  billablePlanForUpgrade,
  resolveBuildCreditsUpgradeOffer,
} from "@/lib/billing/build-credits-upgrade";
import { usePaddleBillingReady, usePaddleCheckout } from "@/components/billing/use-paddle-checkout";
import { toast } from "@/lib/toast";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";

export function BuildCreditsUpgradePanel({
  planId,
  resetAt,
  className,
  onDismiss,
}: {
  planId: string | null | undefined;
  resetAt?: string | null;
  className?: string;
  onDismiss?: () => void;
  /** @deprecated layout is always compact */
  compact?: boolean;
}) {
  const offer = React.useMemo(() => resolveBuildCreditsUpgradeOffer(planId), [planId]);
  const { configured: paddleReady, publicCheckoutEnabled } = usePaddleBillingReady();
  const { startCheckout, busy } = usePaddleCheckout();

  const resetHint = resetAt
    ? `Resets ${new Date(resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null;

  const runUpgrade = () => {
    if (!paddleReady || !publicCheckoutEnabled) {
      toast.error("Checkout is temporarily unavailable. Try again from Settings → Billing.");
      pushRuntimeDiagnostic("credit_charge_blocked", {
        reason: "upgrade_checkout_blocked",
        plan: offer.nextPlanId,
        paddleReady,
        publicCheckoutEnabled,
      });
      return;
    }
    void startCheckout(billablePlanForUpgrade(offer.nextPlanId), false, { source: "pricing" }).then(
      (res) => {
        if (res?.billingAttemptId) {
          pushRuntimeDiagnostic("charge_started", {
            billingAttemptId: res.billingAttemptId,
            plan: offer.nextPlanId,
            source: "upgrade_panel",
          });
        }
      },
    );
  };

  const ctaLabel =
    offer.nextPlanId === "starter"
      ? `Upgrade to Starter — $${offer.monthlyPriceUsd}/mo`
      : offer.ctaLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "build-credits-upgrade-panel relative mx-auto w-full max-w-[min(100%,340px)] overflow-hidden rounded-2xl",
        "ring-1 ring-sky-300/80 shadow-[0_12px_40px_-8px_rgba(37,99,235,0.35)]",
        "dark:ring-sky-500/35 dark:shadow-[0_16px_48px_-12px_rgba(14,116,244,0.45)]",
        className,
      )}
      data-testid="build-credits-upgrade-panel"
    >
      <div className="build-credits-upgrade-panel__aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="build-credits-upgrade-panel__shimmer pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3 pr-7">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-sky-200/80 dark:bg-slate-900/60 dark:ring-sky-400/30">
            <Zap
              className="size-[18px] text-[#2563eb] dark:text-sky-300"
              strokeWidth={2.25}
              fill="currentColor"
              fillOpacity={0.12}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-snug tracking-tight text-foreground">
              Build Credits are used up
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Upgrade to keep building without waiting for your monthly reset.
            </p>
            {resetHint ? (
              <p className="mt-1 text-[10.5px] text-muted-foreground/80">{resetHint}</p>
            ) : null}
          </div>
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground transition hover:bg-surface/80 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        ) : null}

        <ul className="mt-3 space-y-1.5 rounded-xl bg-surface/50 px-3 py-2.5 ring-1 ring-border/70 dark:bg-slate-950/40">
          {offer.perks.map((p) => (
            <li
              key={p}
              className="flex items-start gap-2 text-[11.5px] font-medium leading-snug text-foreground"
            >
              <Check className="mt-0.5 size-3 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2.5} />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={busy}
          onClick={runUpgrade}
          className="build-credits-upgrade-panel__cta mt-3 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60"
          data-testid="upgrade-panel-primary-cta"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-3.5 opacity-90" />}
          {ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}
