"use client";

import { IntroAurora } from "@/components/session/intro/IntroAurora";
import { IntroFloatingParticles } from "@/components/session/intro/IntroFloatingParticles";
import { IntroFallingStars } from "@/components/session/intro-falling-stars";

export function IntroBackground({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <div className="vodex-intro-v3__cosmos vodex-intro-p13__cosmos" aria-hidden />
      <IntroAurora reducedMotion={reducedMotion} />
      <IntroFallingStars active={!reducedMotion} />
      <IntroFloatingParticles reducedMotion={reducedMotion} />
    </>
  );
}
