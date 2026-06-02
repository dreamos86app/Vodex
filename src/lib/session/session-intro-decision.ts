/**
 * Deterministic session intro decision — no profile/onboarding API dependency.
 */

export const INTRO_SESSION_KEY = "vodex_intro_seen_session";
export const INTRO_PENDING_COOKIE = "vodex_session_intro_pending";
export const INTRO_AFTER_ONBOARDING_KEY = "vodex:intro-after-onboarding";

export type IntroDecisionInput = {
  userId: string | null;
  pendingLoginIntro?: boolean;
  hasPendingCookie?: boolean;
  sessionIntroSeen?: boolean;
  onboardingIntroPending?: boolean;
};

export type IntroDecision = {
  shouldShow: boolean;
  reason: string;
};

export function readIntroPendingCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => {
    const [name, value] = part.trim().split("=");
    return name === INTRO_PENDING_COOKIE && value === "1";
  });
}

export function readSessionIntroSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function readOnboardingIntroPending(userId: string | null): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(`${INTRO_AFTER_ONBOARDING_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingIntroPending(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${INTRO_AFTER_ONBOARDING_KEY}:${userId}`, "1");
    sessionStorage.removeItem(INTRO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearOnboardingIntroPending(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${INTRO_AFTER_ONBOARDING_KEY}:${userId}`);
  } catch {
    /* ignore */
  }
}

export function clearIntroPendingCookie(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${INTRO_PENDING_COOKIE}=; Max-Age=0; path=/`;
  } catch {
    /* ignore */
  }
}

export function decideSessionIntro(input: IntroDecisionInput): IntroDecision {
  if (!input.userId) {
    return { shouldShow: false, reason: "no_user" };
  }

  const pending =
    input.pendingLoginIntro === true ||
    input.hasPendingCookie === true;
  if (pending) {
    return { shouldShow: true, reason: "pending_cookie" };
  }

  if (input.onboardingIntroPending) {
    return { shouldShow: true, reason: "onboarding_complete" };
  }

  if (input.sessionIntroSeen) {
    return { shouldShow: false, reason: "session_already_seen" };
  }

  return { shouldShow: true, reason: "fresh_tab_entry" };
}
