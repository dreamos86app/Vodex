"use client";

type NavMark = {
  href: string;
  startedAt: number;
};

const SLOW_MS = 1500;
const TARGET_MS = 700;

let pending: NavMark | null = null;

export function markNavigationStart(href: string) {
  pending = { href, startedAt: performance.now() };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dreamos:nav-start", { detail: { href } }));
  }
}

export function markNavigationComplete(pathname: string) {
  if (!pending) return;
  const elapsed = Math.round(performance.now() - pending.startedAt);
  const href = pending.href;
  pending = null;

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dreamos:nav-complete", { detail: { href, pathname, elapsedMs: elapsed } }),
    );
  }

  if (elapsed > SLOW_MS) {
    console.warn(`[nav] slow route ${pathname}: ${elapsed}ms (budget ${TARGET_MS}–${SLOW_MS}ms)`);
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[nav] ${pathname}: ${elapsed}ms`);
  }
}

export const NAV_PERF_BUDGET = { targetMs: TARGET_MS, slowMs: SLOW_MS } as const;
