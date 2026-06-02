"use client";

import { motion } from "framer-motion";

export function IntroAurora({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <div className="vodex-intro-p13__aurora-wrap pointer-events-none absolute inset-0" aria-hidden>
      <motion.div
        className="vodex-intro-p13__aurora vodex-intro-p13__aurora--a"
        animate={{ x: ["-8%", "12%", "-5%"], opacity: [0.35, 0.55, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="vodex-intro-p13__aurora vodex-intro-p13__aurora--b"
        animate={{ x: ["10%", "-6%", "8%"], opacity: [0.25, 0.45, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
    </div>
  );
}
