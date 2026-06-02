"use client";

import { motion } from "framer-motion";

const RINGS = [0, 1, 2, 3];
const SPIRALS = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  angle: (i / 36) * Math.PI * 2,
  delay: i * 0.008,
}));

export function IntroVortex({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="vodex-intro-p13__vortex pointer-events-none absolute inset-0 z-[9] flex items-center justify-center"
      aria-hidden
    >
      <motion.div
        className="vodex-intro-p13__vortex-core"
        initial={{ opacity: 0, scale: 0.15 }}
        animate={{ opacity: [0, 1, 0.75], scale: [0.15, 2.8, 3.4] }}
        transition={{ duration: 0.65, ease: [0.45, 0, 0.15, 1] }}
      />
      {RINGS.map((r) => (
        <motion.div
          key={r}
          className="vodex-intro-p13__vortex-ring"
          style={{ ["--ring-i" as string]: r } as React.CSSProperties}
          initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.4, 2.2 + r * 0.35, 2.8], rotate: 180 + r * 45 }}
          transition={{ duration: 0.7, delay: r * 0.06, ease: "easeOut" }}
        />
      ))}
      {SPIRALS.map((s) => {
        const startX = Math.cos(s.angle) * 160;
        const startY = Math.sin(s.angle) * 160;
        return (
          <motion.span
            key={s.id}
            className="vodex-intro-p13__vortex-particle"
            initial={{ x: startX, y: startY, opacity: 0.95, scale: 1 }}
            animate={{ x: 0, y: 0, opacity: 0, scale: 0.15 }}
            transition={{ duration: 0.72, delay: s.delay, ease: [0.55, 0, 0.2, 1] }}
          />
        );
      })}
      <motion.div
        className="vodex-intro-p13__vortex-aberration"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.5, delay: 0.15 }}
      />
    </div>
  );
}
