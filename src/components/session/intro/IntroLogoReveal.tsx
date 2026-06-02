"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { PREMIUM_EASE } from "@/components/session/intro/intro-constants";

export function IntroLogoReveal({
  visible,
  reducedMotion,
  onRevealComplete,
}: {
  visible: boolean;
  reducedMotion: boolean;
  onRevealComplete?: () => void;
}) {
  const delay = reducedMotion ? 0.08 : 0.05;
  const completeRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible || completeRef.current) return;
    const ms = reducedMotion ? 900 : 1300;
    const t = window.setTimeout(() => {
      completeRef.current = true;
      onRevealComplete?.();
    }, ms);
    return () => window.clearTimeout(t);
  }, [visible, reducedMotion, onRevealComplete]);

  return (
    <motion.div
      className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="vodex-cinematic-intro__icon-wrap vodex-intro-p13__logo-wrap relative flex size-28 items-center justify-center"
        initial={{ opacity: 0, scale: 0.12 }}
        animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.12 }}
        transition={{
          delay,
          duration: 0.7,
          type: "spring",
          stiffness: 190,
          damping: 18,
        }}
      >
        <motion.div
          className="vodex-intro-p13__logo-bloom absolute inset-0 rounded-full"
          animate={visible ? { scale: [0.35, 1.9, 1.3], opacity: [0, 1, 0.5] } : {}}
          transition={{ delay, duration: 0.95 }}
          aria-hidden
        />
        <motion.div
          className="vodex-intro-p13__logo-ring absolute inset-[-22%] rounded-full border border-sky-300/45"
          animate={visible ? { scale: [0.55, 1.55], opacity: [0.85, 0] } : {}}
          transition={{ delay: delay + 0.12, duration: 1 }}
          aria-hidden
        />
        <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-24" />
      </motion.div>

      <div className="mt-6 flex items-center justify-center" aria-hidden>
        {(["V", "O", "D", "E", "X"] as const).map((ch, i) => (
          <motion.span
            key={ch}
            className="vodex-cinematic-intro__letter text-3xl font-semibold tracking-[0.24em] text-white drop-shadow-[0_0_18px_rgba(125,211,252,0.45)]"
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={
              visible
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 24, filter: "blur(8px)" }
            }
            transition={{
              delay: delay + 0.14 + i * 0.08,
              duration: 0.45,
              ease: PREMIUM_EASE,
            }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        className="vodex-cinematic-intro__tagline vodex-intro-p13__tagline relative mt-3 text-sm font-medium tracking-wide text-sky-100/90"
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ delay: delay + 0.58, duration: 0.5, ease: PREMIUM_EASE }}
      >
        Preparing your workspace
      </motion.p>
    </motion.div>
  );
}
