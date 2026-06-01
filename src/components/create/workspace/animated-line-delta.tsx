"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

function useAnimatedCount(target: number | undefined, durationMs = 380): number | undefined {
  const reduced = useReducedMotion();
  const fromRef = React.useRef(target ?? 0);
  const [display, setDisplay] = React.useState(target);

  React.useEffect(() => {
    if (target == null) {
      setDisplay(undefined);
      fromRef.current = 0;
      return;
    }
    if (reduced) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 2;
      const next = Math.round(from + (target - from) * eased);
      setDisplay(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, durationMs]);

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
  const addedN = useAnimatedCount(added, active ? 320 : 420);
  const removedN = useAnimatedCount(removed, active ? 320 : 420);
  if (added == null && removed == null) return null;

  return (
    <span
      className={cn("shrink-0 font-mono text-[10px] tabular-nums", className)}
      data-testid="animated-line-delta"
    >
      {addedN != null ? (
        <span
          className={cn(
            "text-emerald-500/90 transition-transform",
            active && "animate-[pulse_1.2s_ease-in-out_infinite]",
          )}
        >
          +{addedN}
        </span>
      ) : null}
      {removedN != null ? (
        <span
          className={cn(
            "text-red-400/90 transition-transform",
            active && "animate-[pulse_1.2s_ease-in-out_infinite]",
            addedN != null && "ml-1",
          )}
        >
          -{removedN}
        </span>
      ) : null}
    </span>
  );
}
