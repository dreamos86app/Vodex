/** P1.4 cinematic intro timeline (seconds) — dynamic finish after logo settles */
export const SHOWCASE_START_S = 0.3;
export const SHOWCASE_END_S = 2.4;
export const COLLAPSE_END_S = 3.3;
export const LOGO_REVEAL_START_S = 3.3;
/** After logo + tagline animation completes, hold briefly then fade out */
export const POST_REVEAL_SETTLE_MS = 500;
export const EXIT_FADE_MS = 420;
/** Tagline motion: delay + transition (seconds) — must match IntroLogoReveal */
export const LOGO_TAGLINE_END_S = 0.05 + 0.58 + 0.5;

export const APP_ENTRANCE_S = {
  nova: 0.3,
  bite: 0.7,
  frame: 1.1,
  apex: 1.5,
} as const;

export const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;
export const COLLAPSE_EASE = [0.55, 0, 0.2, 1] as const;
