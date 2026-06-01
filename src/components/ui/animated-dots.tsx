"use client";

import * as React from "react";

const MAX_DOTS = 3;
const TICK_MS = 450;

/** Animated ellipsis: `.` → `..` → `...` (never 4+). */
export function useAnimatedDots(active = true): string {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setFrame(0);
      return;
    }
    const id = setInterval(() => setFrame((f) => (f + 1) % MAX_DOTS), TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  return ".".repeat(frame + 1);
}

export function AnimatedDotsText({
  base,
  active = true,
  className,
}: {
  base: string;
  active?: boolean;
  className?: string;
}) {
  const dots = useAnimatedDots(active);
  const text = `${base.replace(/\.+$/u, "")}${dots}`;
  return <span className={className}>{text}</span>;
}
