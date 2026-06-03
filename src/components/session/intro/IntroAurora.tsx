"use client";

/** CSS-only aurora — avoids framer-motion repaints on the intro hot path. */
export function IntroAurora({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <div className="vodex-intro-p13__aurora-wrap pointer-events-none absolute inset-0" aria-hidden>
      <div className="vodex-intro-p13__aurora vodex-intro-p13__aurora--a" />
      <div className="vodex-intro-p13__aurora vodex-intro-p13__aurora--b" />
    </div>
  );
}
