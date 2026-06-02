"use client";

import type { CSSProperties } from "react";

const SPECS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${(i * 17) % 100}%`,
  delay: (i % 7) * 0.35,
  size: 2 + (i % 3),
  depth: 0.4 + (i % 5) * 0.12,
}));

export function IntroFloatingParticles({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <div className="vodex-intro-p13__particles pointer-events-none absolute inset-0" aria-hidden>
      {SPECS.map((p) => (
        <span
          key={p.id}
          className="vodex-intro-p13__particle"
          style={
            {
              left: p.left,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              ["--p-depth" as string]: p.depth,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
