"use client";

import { cn } from "@/lib/utils";

export function BuilderQualityStrip({ score, className }: { score: number; className?: string }) {
  const ready = score >= 70;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        ready ? "bg-positive-muted text-positive" : "bg-warning-muted text-warning",
        className,
      )}
    >
      Quality {score}%
    </span>
  );
}
