"use client";

import { motion } from "framer-motion";
import type { IntroAppConfig } from "@/components/session/intro/intro-apps";
import { IntroAliveOverlay } from "@/components/session/intro/IntroAliveOverlay";
import { IntroReferenceImage } from "@/components/session/intro/IntroReferenceImage";
import { COLLAPSE_EASE, PREMIUM_EASE, SHOWCASE_END_S } from "@/components/session/intro/intro-constants";

export function CinematicAppPanel({
  app,
  layout,
  timeline,
  reducedMotion,
}: {
  app: IntroAppConfig;
  layout: "desktop" | "mobile";
  timeline: number;
  reducedMotion: boolean;
}) {
  const corner = layout === "mobile" ? app.mobile : app.desktop;
  const frameClass =
    layout === "mobile"
      ? "aspect-square w-[min(46vw,228px)] max-h-[min(46vw,228px)]"
      : "aspect-[5/4] w-[min(46vw,520px)] max-h-[min(46vh,416px)]";

  const entered = timeline >= app.enterAt;
  const collapsing = timeline >= SHOWCASE_END_S;
  const floatY = entered && !collapsing ? Math.sin(timeline * 1.35 + app.enterAt) * 5 : 0;

  const panel = (
    <div className="vodex-intro-p13__image-panel relative h-full w-full overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-sky-300/25">
      <IntroReferenceImage
        src={app.imageSrc}
        alt={app.imageAlt}
        layout={layout}
        panelId={app.id}
      />
      <IntroAliveOverlay accent={app.accent} />
      <div className="vodex-intro-p13__glass-sheen pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );

  if (reducedMotion) {
    if (!entered || timeline >= SHOWCASE_END_S + 0.25) return null;
    return (
      <div
        className={`vodex-intro-v3__screen vodex-intro-p13__panel absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
        data-intro-app-panel={app.id}
        style={{
          transform: `translate(calc(-50% + ${corner.x}), calc(-50% + ${corner.y})) scale(${corner.scale})`,
        }}
      >
        {panel}
      </div>
    );
  }

  return (
    <motion.div
      className={`vodex-intro-v3__screen vodex-intro-p13__panel absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
      data-intro-app-panel={app.id}
      initial={false}
      animate={
        collapsing
          ? {
              opacity: [1, 0.9, 0],
              scale: [corner.scale, corner.scale * 0.86, 0.06],
              x: [corner.x, "0%", "0%"],
              y: [corner.y, "0%", "0%"],
              rotate: [corner.rotate, corner.rotate * 2.2, 0],
              filter: ["blur(0px)", "blur(1px)", "blur(12px)"],
            }
          : entered
            ? {
                opacity: 1,
                scale: corner.scale,
                x: corner.x,
                y: `calc(${corner.y} + ${floatY}px)`,
                rotate: corner.rotate,
                filter: "blur(0px)",
              }
            : {
                opacity: 0,
                scale: corner.scale * 0.9,
                x: app.entrance.fromX,
                y: app.entrance.fromY,
                rotate: app.entrance.fromRotate,
                filter: "blur(10px)",
              }
      }
      transition={
        collapsing
          ? { duration: 0.65, ease: COLLAPSE_EASE }
          : entered
            ? { duration: 0.9, ease: PREMIUM_EASE }
            : { duration: 0.01 }
      }
      style={{
        zIndex: corner.z,
        perspective: 1500,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        className={`vodex-intro-p13__glow-trail vodex-intro-p13__glow-trail--${app.entrance.glow}`}
        aria-hidden
      />
      <div className="vodex-intro-v3__chromatic vodex-intro-p13__chromatic relative h-full w-full shadow-[0_36px_100px_-24px_rgba(0,0,0,0.75)]">
        {panel}
      </div>
    </motion.div>
  );
}
