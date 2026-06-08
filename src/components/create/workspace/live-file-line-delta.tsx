"use client";

import * as React from "react";
import { AnimatedLineDelta } from "@/components/create/workspace/animated-line-delta";
import { cn } from "@/lib/utils";

/** Real line deltas only — no placeholder estimates. */
export function LiveFileLineDelta({
  active,
  added,
  removed,
  className,
}: {
  path: string;
  active: boolean;
  added?: number;
  removed?: number;
  className?: string;
}) {
  const hasReal =
    (typeof added === "number" && added > 0) ||
    (typeof removed === "number" && removed > 0) ||
    (!active && typeof added === "number");

  if (active && !hasReal) {
    return (
      <span
        className={cn(
          "shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground",
          className,
        )}
        data-testid="live-file-line-delta"
      >
        <span className="inline-block animate-pulse">writing…</span>
      </span>
    );
  }

  if (!hasReal) return null;

  return (
    <AnimatedLineDelta
      added={added ?? 0}
      removed={removed ?? 0}
      active={active}
      className={className}
    />
  );
}
