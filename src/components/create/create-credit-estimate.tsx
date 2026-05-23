"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const COST_COPY: Record<string, string> = {
  quick: "Light build — faster, simpler apps",
  standard: "Standard build — balanced quality",
  production: "Full build — maximum polish",
};

export function CreateCreditEstimate({
  buildTier = "standard",
  cheaperRecommended,
  className,
}: {
  credits?: number | null;
  creditsMax?: number | null;
  buildTier?: string;
  cheaperRecommended?: boolean;
  className?: string;
}) {
  const copy = COST_COPY[buildTier] ?? "Standard build — balanced quality";
  return (
    <div className={cn("rounded-2xl bg-accent/8 px-4 py-3 ring-1 ring-accent/15", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-foreground">Build depth</p>
      </div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{copy}</p>
      {cheaperRecommended && (
        <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          A lighter build depth is recommended for your balance.
        </p>
      )}
    </div>
  );
}
