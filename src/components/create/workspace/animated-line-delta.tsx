"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const STEP_MS = 1000;

/** Animate count in ~1s steps (smooth live deltas). */
function useAnimatedCountStep(target: number | undefined): number | undefined {
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
    let current = fromRef.current;
    if (current === target) {
      setDisplay(target);
      return;
    }
    const id = window.setInterval(() => {
      const diff = target - current;
      if (diff === 0) {
        window.clearInterval(id);
        return;
      }
      const step = Math.max(1, Math.ceil(Math.abs(diff) / 8));
      current += diff > 0 ? step : -step;
      if ((diff > 0 && current >= target) || (diff < 0 && current <= target)) {
        current = target;
      }
      fromRef.current = current;
      setDisplay(current);
      if (current === target) window.clearInterval(id);
    }, STEP_MS);
    return () => window.clearInterval(id);
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
  const addedN = useAnimatedCountStep(added);
  const removedN = useAnimatedCountStep(removed);
  const [bump, setBump] = React.useState(0);
  React.useEffect(() => {
    if (added == null && removed == null) return;
    setBump((b) => b + 1);
  }, [added, removed]);

  if (added == null && removed == null) return null;

  return (
    <span
      className={cn("shrink-0 font-mono text-[10px] tabular-nums", className)}
      data-testid="animated-line-delta"
      key={bump}
    >
      {addedN != null ? (
        <span
          className={cn(
            "inline-block text-blue-500 transition-all duration-500 ease-out",
            active && "animate-[pulse_1.2s_ease-in-out_infinite]",
            bump > 0 && "animate-[delta-bump_0.35s_ease-out]",
          )}
        >
          +{addedN}
        </span>
      ) : null}
      {removedN != null ? (
        <span
          className={cn(
            "text-red-500 transition-all duration-500 ease-out",
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
