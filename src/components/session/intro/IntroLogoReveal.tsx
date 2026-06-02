"use client";

import { motion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { PREMIUM_EASE } from "@/components/session/intro/intro-constants";

export function IntroLogoReveal({ visible, reducedMotion }: { visible: boolean; reducedMotion: boolean }) {
  const delay = reducedMotion ? 0.08 : 0.05;

  return (
    <motion.div
      className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="vodex-cinematic-intro__icon-wrap vodex-intro-p13__logo-wrap relative flex size-28 items-center justify-center"
        initial={{ opacity: 0, scale: 0.15 }}
        animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.15 }}
        transition={{
          delay,
          duration: 0.65,
          type: "spring",
          stiffness: 200,
          damping: 18,
        }}
      >
        <motion.div
          className="vodex-intro-p13__logo-bloom absolute inset-0 rounded-full"
          animate={visible ? { scale: [0.4, 1.8, 1.25], opacity: [0, 0.95, 0.45] } : {}}
          transition={{ delay, duration: 0.85 }}
          aria-hidden
        />
        <motion.div
          className="vodex-intro-p13__logo-ring absolute inset-[-20%] rounded-full border border-sky-300/40"
          animate={visible ? { scale: [0.6, 1.4], opacity: [0.8, 0] } : {}}
          transition={{ delay: delay + 0.1, duration: 0.9 }}
          aria-hidden
        />
        <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-24" />
      </motion.div>

      <div className="mt-6 flex items-center justify-center" aria-hidden>
        {(["V", "O", "D", "E", "X"] as const).map((ch, i) => (
          <motion.span
            key={ch}
            className="vodex-cinematic-intro__letter text-3xl font-semibold tracking-[0.24em] text-white"
            initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
            animate={
              visible
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 22, filter: "blur(6px)" }
            }
            transition={{
              delay: delay + 0.1 + i * 0.07,
              duration: 0.42,
              ease: PREMIUM_EASE,
            }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        className="vodex-cinematic-intro__tagline vodex-intro-p13__tagline mt-3 text-sm font-medium tracking-wide text-sky-100/90"
        initial={{ opacity: 0, y: 12 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: delay + 0.48, duration: 0.45, ease: PREMIUM_EASE }}
      >
        Preparing your workspace
      </motion.p>
    </motion.div>
  );
}
