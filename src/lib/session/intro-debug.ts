"use client";

import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import type { IntroDecision } from "@/lib/session/session-intro-decision";

export function logIntroDecision(
  email: string | null | undefined,
  payload: {
    userId: string | null;
    hasPendingCookie: boolean;
    seenSession: boolean;
    shouldShow: boolean;
    reason: string;
    appVisible: boolean;
  },
): void {
  if (!isDreamosOwnerEmail(email ?? null)) return;
  console.info("[Vodex][intro] decision", payload);
}

export function registerIntroDebugHook(showIntroNow: () => void): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __vodexShowIntro?: () => void };
  w.__vodexShowIntro = () => {
    try {
      sessionStorage.removeItem("vodex_intro_seen_session");
      document.cookie = "vodex_session_intro_pending=1; path=/; max-age=120; SameSite=Lax";
    } catch {
      /* ignore */
    }
    showIntroNow();
  };
}

export function formatIntroDecision(decision: IntroDecision): string {
  return decision.reason;
}
