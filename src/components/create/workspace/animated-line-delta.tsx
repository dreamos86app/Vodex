"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

function useAnimatedCount(target: number | undefined, durationMs = 420): number | undefined {
  const reduced = useReducedMotion();
  const [display, setDisplay] = React.useState(target);

  React.useEffect(() => {
    if (target == null) {
      setDisplay(undefined);
      return;
    }
    if (reduced) {
      setDisplay(target);
      return;
    }
    const from = display ?? 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(Math.round(from + (target - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return display;
}

export function AnimatedLineDelta({
  added,
  removed,
  active,
  className,
}: {
  added?: number;
  removed?: number;
  active?: boolean;
  className?: string;
}) {
  const addedN = useAnimatedCount(added);
  const removedN = useAnimatedCount(removed);
  if (added == null && removed == null) return null;

  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[10px] tabular-nums",
        active && "animate-pulse",
        className,
      )}
    >
      {addedN != null ? <span className="text-emerald-500/90">+{addedN}</span> : null}
      {removedN != null ? (
        <span className="text-red-400/90">{addedN != null ? " " : ""}-{removedN}</span>
      ) : null}
    </span>
  );
}
