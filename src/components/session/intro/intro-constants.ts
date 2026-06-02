/** P1.3 cinematic intro timeline (seconds) */
export const INTRO_TOTAL_S = 3.8;
export const INTRO_TOTAL_MS = INTRO_TOTAL_S * 1000;

export const SHOWCASE_END_S = 2.5;
export const COLLAPSE_END_S = 3.1;

/** Staggered app entrances */
export const APP_ENTRANCE_S = {
  nova: 0.15,
  bite: 0.55,
  frame: 0.95,
  apex: 1.35,
} as const;

export const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;
export const COLLAPSE_EASE = [0.55, 0, 0.2, 1] as const;
