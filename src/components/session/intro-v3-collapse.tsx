"use client";

import { motion } from "framer-motion";

const FRAGMENTS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  angle: (i / 28) * Math.PI * 2,
  dist: 120 + (i % 5) * 40,
  w: 8 + (i % 4) * 6,
  h: 4 + (i % 3) * 5,
  blue: i % 3 !== 0,
}));

/** Phase 2 — UI fragments spiral into center */
export function IntroV3Collapse({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center" aria-hidden>
      <motion.div
        className="absolute size-40 rounded-full bg-sky-400/30 blur-3xl"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0.6], scale: [0.2, 2.2, 3] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {FRAGMENTS.map((f) => {
        const startX = Math.cos(f.angle) * f.dist;
        const startY = Math.sin(f.angle) * f.dist;
        return (
          <motion.span
            key={f.id}
            className={`absolute rounded-sm ${f.blue ? "bg-sky-400/80" : "bg-white/70"} shadow-[0_0_12px_rgba(56,189,248,0.5)]`}
            style={{ width: f.w, height: f.h }}
            initial={{
              x: startX,
              y: startY,
              opacity: 0.9,
              rotate: f.angle * (180 / Math.PI),
            }}
            animate={{
              x: 0,
              y: 0,
              opacity: 0,
              scale: 0.2,
              rotate: f.angle * (180 / Math.PI) + 180,
            }}
            transition={{
              duration: 0.85,
              delay: f.id * 0.012,
              ease: [0.55, 0, 0.2, 1],
            }}
          />
        );
      })}
      {["{ }", "</>", "AI", "◇", "◆"].map((glyph, i) => (
        <motion.span
          key={glyph}
          className="absolute font-mono text-[11px] font-bold text-cyan-200/90"
          initial={{ opacity: 0, x: (i - 2) * 80, y: (i % 2) * 60 - 30 }}
          animate={{ opacity: [0, 1, 0], x: 0, y: 0, scale: 0.3 }}
          transition={{ duration: 0.75, delay: 0.1 + i * 0.05 }}
        >
          {glyph}
        </motion.span>
      ))}
    </div>
  );
}
