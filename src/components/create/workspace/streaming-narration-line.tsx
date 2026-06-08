"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/** Smooth typewriter reveal for assistant narration during builds. */
export function StreamingNarrationLine({
  text,
  active = false,
  className,
}: {
  text: string;
  active?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = React.useState(reducedMotion ? text.length : 0);
  const prevText = React.useRef(text);

  React.useEffect(() => {
    if (text !== prevText.current) {
      prevText.current = text;
      setVisible(reducedMotion ? text.length : 0);
    }
  }, [text, reducedMotion]);

  React.useEffect(() => {
    if (!active || reducedMotion) {
      setVisible(text.length);
      return;
    }
    if (visible >= text.length) return;
    const delay = text[visible] === " " ? 12 : 18;
    const id = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(id);
  }, [active, reducedMotion, text, visible]);

  const shown = text.slice(0, visible);
  const trailing = active && visible < text.length;

  return (
    <p
      className={className}
      data-testid="workflow-chat-assistant"
      data-streaming={trailing ? "true" : "false"}
    >
      {shown}
      {trailing ? <span className="inline-block w-[2px] animate-pulse bg-foreground/50" aria-hidden /> : null}
    </p>
  );
}
