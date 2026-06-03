"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { cn } from "@/lib/utils";
import { getCreditAllowance } from "@/lib/billing/plan-entitlements";
import { PLAN_DISPLAY } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";

interface Plan {
  id: PlanId;
  name: string;
  buildCredits: number;
  actionCredits: number;
  price: number;
  highlight?: boolean;
  badge?: string;
}

const UPGRADE_PLANS: Plan[] = (["starter", "pro"] as PlanId[]).map((id) => {
  const allowance = getCreditAllowance(id);
  const display = PLAN_DISPLAY[id];
  return {
    id,
    name: display.name,
    buildCredits: allowance.build,
    actionCredits: allowance.action,
    price: display.priceMonthlyUsd ?? 0,
    highlight: id === "pro",
    badge: id === "pro" ? "Most popular" : undefined,
  };
});

interface CreditsUpgradeModalProps {
  onClose: () => void;
  currentPlanId?: string;
}

export function CreditsUpgradeModal({ onClose, currentPlanId = "free" }: CreditsUpgradeModalProps) {
  const { build, totalUsedThisPeriod } = useCreditsStore();
  const totalCredits = build.available + totalUsedThisPeriod;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] bg-background shadow-2xl ring-1 ring-border"
      >
        <div className="relative flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-accent/10">
              <Zap className="size-5 text-accent" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">You&apos;re out of Build Credits</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Upgrade to keep building. Your progress is saved.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-[12.5px] font-medium text-foreground">This period</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12.5px]">
              <span className="font-semibold tabular-nums text-foreground">{totalUsedThisPeriod.toLocaleString()}</span>
              <span className="text-muted-foreground">/ {totalCredits.toLocaleString()} Build Credits used</span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 p-6">
          {UPGRADE_PLANS.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition",
                  plan.highlight ? "ring-accent/30 bg-accent/5" : "ring-border bg-surface",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{plan.name}</p>
                    {plan.badge && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {plan.buildCredits.toLocaleString()} Build + {plan.actionCredits.toLocaleString()} Action Credits / mo
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-foreground">${plan.price}/mo</span>
                  {isCurrent ? (
                    <span className="text-[11px] text-muted-foreground">Current</span>
                  ) : (
                    <Link
                      href="/pricing"
                      className="vodex-upgrade-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold"
                    >
                      Upgrade
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Keep editing later
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
