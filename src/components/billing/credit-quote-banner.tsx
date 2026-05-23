"use client";

import * as React from "react";
import { Coins, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreditQuoteDisplay = {
  estimatedCost: number;
  reservedEstimate?: number;
  label?: string;
  safeToRun?: boolean;
  balance?: number;
  included?: string[];
  savingsNote?: string;
};

type Props = {
  quote: CreditQuoteDisplay | null;
  loading?: boolean;
  className?: string;
};

export function CreditQuoteBanner({ quote, loading, className }: Props) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-surface/80 px-4 py-3 text-[13px] text-muted-foreground",
          className,
        )}
      >
        Calculating estimated cost…
      </div>
    );
  }

  if (!quote) return null;

  const lowBalance =
    quote.balance != null && quote.estimatedCost > quote.balance;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        lowBalance
          ? "border-warning/40 bg-warning-muted/30"
          : "border-border/60 bg-surface/80",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-accent" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-medium text-foreground">
              Estimated cost: {quote.estimatedCost} credits
            </p>
            {quote.label ? (
              <p className="text-[12px] text-muted-foreground">{quote.label}</p>
            ) : null}
          </div>
        </div>
        {quote.safeToRun !== false ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-positive-muted px-2 py-0.5 text-[11px] font-medium text-positive">
            <ShieldCheck className="size-3" />
            Safe to run
          </span>
        ) : null}
      </div>
      {quote.included?.length ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Included: {quote.included.join(", ")}
        </p>
      ) : null}
      {quote.savingsNote ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-accent" />
          {quote.savingsNote}
        </p>
      ) : null}
      {lowBalance ? (
        <p className="mt-2 text-[12px] font-medium text-warning">
          Not enough credits. Add credits or choose a smaller scope.
        </p>
      ) : null}
    </div>
  );
}
