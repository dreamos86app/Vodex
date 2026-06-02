"use client";

import type { CSSProperties } from "react";
import type { IntroAppAccent } from "@/components/session/intro/intro-apps";

/** Subtle “alive” motion layered on generated app UIs */
export function IntroAliveOverlay({ accent }: { accent: IntroAppAccent }) {
  return (
    <div className="vodex-intro-p13__alive pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <div className={`vodex-intro-p13__shimmer vodex-intro-p13__shimmer--${accent}`} />
      <span className="vodex-intro-p13__cursor" />
      {accent === "nova" ? (
        <span className="vodex-intro-p13__badge vodex-intro-p13__badge--purple">2</span>
      ) : null}
      {accent === "bite" ? (
        <span className="vodex-intro-p13__badge vodex-intro-p13__badge--orange">12 min</span>
      ) : null}
      {accent === "frame" ? (
        <span className="vodex-intro-p13__scanlines" />
      ) : null}
      {accent === "apex" ? (
        <div className="vodex-intro-p13__sparkline">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="vodex-intro-p13__spark"
              style={{ ["--spark-i" as string]: i } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
