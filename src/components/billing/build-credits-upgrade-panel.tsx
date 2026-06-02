"use client";

import * as React from "react";
import Link from "next/link";
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

export function BuildCreditsUpgradePanel({
  planId,
  resetAt,
  className,
  onDismiss,
  compact,
}: {
  planId: string | null | undefined;
  resetAt?: string | null;
  className?: string;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const offer = React.useMemo(() => resolveBuildCreditsUpgradeOffer(planId), [planId]);
  const { configured: paddleReady, publicCheckoutEnabled } = usePaddleBillingReady();
  const { startCheckout, busy } = usePaddleCheckout();

  const resetHint = resetAt
    ? `Credits reset ${new Date(resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#060d1f] ring-1 ring-sky-500/35 shadow-[0_16px_48px_-16px_rgba(37,99,235,0.45)]",
        className,
      )}
      data-testid="build-credits-upgrade-panel"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600/20 via-[#1d4ed8]/15 to-indigo-900/25 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-[#2563eb] to-indigo-500" />

      <div className={cn("relative px-4 py-4 sm:px-5 sm:py-5", compact && "py-3.5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#2563eb]/20 ring-1 ring-sky-400/40">
              <Zap className="size-5 text-sky-300" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-white">Build Credits are used up</p>
              <p className="mt-1 text-[12.5px] text-sky-100/85 leading-relaxed">
                Upgrade to keep building without waiting for reset.
              </p>
              {resetHint ? (
                <p className="mt-1 text-[10.5px] text-sky-200/55">{resetHint}</p>
              ) : null}
            </div>
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1.5 text-sky-200/60 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-sky-400/25 bg-[#0b1530]/60 px-3.5 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-sky-300" />
              <p className="text-[13px] font-semibold text-white">{offer.nextPlanLabel}</p>
            </div>
            <p className="text-[22px] font-black tabular-nums text-white leading-none">
              ${offer.monthlyPriceUsd}
              <span className="text-[11px] font-medium text-sky-200/70">/mo</span>
            </p>
          </div>
          <ul className="mt-2.5 space-y-1">
            {offer.perks.slice(0, 5).map((p) => (
              <li key={p} className="text-[11px] text-sky-100/80">
                • {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={runUpgrade}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(37,99,235,0.65)] transition hover:brightness-110 disabled:opacity-60 sm:flex-[1.4]"
            data-testid="upgrade-panel-primary-cta"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {offer.ctaLabel}
          </button>
          <Link
            href="/settings/billing"
            className="inline-flex items-center justify-center rounded-xl border border-sky-400/30 bg-white/5 px-3.5 py-2.5 text-[12px] font-semibold text-sky-50 hover:bg-white/10"
          >
            Add credits
          </Link>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-sky-200/70 hover:text-white"
            >
              Save for later
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
