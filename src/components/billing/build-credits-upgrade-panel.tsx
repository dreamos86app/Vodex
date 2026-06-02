"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  billablePlanForUpgrade,
  resolveBuildCreditsUpgradeOffer,
} from "@/lib/billing/build-credits-upgrade";
import { usePaddleBillingReady, usePaddleCheckout } from "@/components/billing/use-paddle-checkout";
import { toast } from "@/lib/toast";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";

const SPARKLE_OFFSETS = [
  { top: "12%", left: "78%", delay: 0 },
  { top: "42%", left: "8%", delay: 0.4 },
  { top: "68%", left: "88%", delay: 0.8 },
] as const;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "build-credits-upgrade-panel relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl",
        "ring-1 ring-sky-300/80 shadow-[0_12px_40px_-8px_rgba(37,99,235,0.35)]",
        className,
      )}
      data-testid="build-credits-upgrade-panel"
    >
      <div className="build-credits-upgrade-panel__aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="build-credits-upgrade-panel__shimmer pointer-events-none absolute inset-0" aria-hidden />

      {SPARKLE_OFFSETS.map((s, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute text-amber-300/90"
          style={{ top: s.top, left: s.left }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.85, 1.15, 0.85], rotate: [0, 12, 0] }}
          transition={{ duration: 2.2, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <Sparkles className="size-3" strokeWidth={2} />
        </motion.span>
      ))}

      <div className="relative px-3.5 py-3">
        <div className="flex items-start gap-2.5 pr-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm ring-1 ring-sky-200/80">
            <Zap className="size-4 text-[#2563eb]" strokeWidth={2.25} fill="#2563eb" fillOpacity={0.15} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-snug tracking-tight text-sky-950">
              Build Credits are used up
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-sky-800/85">
              Upgrade to keep building without waiting.
            </p>
            {resetHint ? (
              <p className="mt-0.5 text-[9.5px] text-sky-700/70">{resetHint}</p>
            ) : null}
          </div>
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 rounded-lg p-1 text-sky-700/50 transition hover:bg-white/50 hover:text-sky-900"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        ) : null}

        <div className="mt-2.5 rounded-xl bg-white/45 px-2.5 py-2 ring-1 ring-white/60 backdrop-blur-[2px]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-sky-900">{offer.nextPlanLabel}</p>
            <p className="text-[17px] font-black tabular-nums leading-none text-sky-950">
              ${offer.monthlyPriceUsd}
              <span className="text-[9px] font-semibold text-sky-700/75">/mo</span>
            </p>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {offer.perks.slice(0, 4).map((p) => (
              <li
                key={p}
                className="flex items-center gap-1.5 text-[10px] font-medium leading-tight text-amber-700"
              >
                <Sparkles className="size-2.5 shrink-0 text-amber-500" strokeWidth={2.5} />
                <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 bg-clip-text text-transparent">
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={runUpgrade}
          className="build-credits-upgrade-panel__cta mt-2.5 flex w-full min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white disabled:opacity-60"
          data-testid="upgrade-panel-primary-cta"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-3.5 opacity-90" />}
          {offer.ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}
