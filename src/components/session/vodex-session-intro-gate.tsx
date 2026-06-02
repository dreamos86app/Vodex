"use client";

import * as React from "react";
import {
  VodexSessionIntro,
  markSessionIntroSeen,
} from "@/components/session/vodex-session-intro";
import { useAuthStore } from "@/lib/stores/auth-store";
import { runSessionPreload } from "@/lib/bootstrap/session-preload";
import { beginSessionCreditsWarmup } from "@/lib/credits/session-credits-warmup";
import {
  clearIntroPendingCookie,
  clearOnboardingIntroPending,
  decideSessionIntro,
  readIntroPendingCookie,
  readOnboardingIntroPending,
  readSessionIntroSeen,
} from "@/lib/session/session-intro-decision";
import { logIntroDecision, registerIntroDebugHook } from "@/lib/session/intro-debug";
import { preloadIntroReferenceImages } from "@/components/session/intro/intro-image-preload";
import { usePathname } from "next/navigation";

type EntryPhase = "deciding" | "intro" | "ready";

/**
 * Session entry: VODEX intro on first tab visit, after login, or after onboarding.
 * Mounted only inside authenticated AppChromeProviders (never on marketing-only shells).
 */
export function VodexSessionIntroGate({
  children,
  serverUserId,
  pendingLoginIntro = false,
}: {
  children: React.ReactNode;
  serverUserId?: string;
  pendingLoginIntro?: boolean;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const email = useAuthStore((s) => s.user?.email ?? s.profile?.email);

  const userId = serverUserId ?? user?.id ?? null;

  const [phase, setPhase] = React.useState<EntryPhase>(() =>
    userId ? "deciding" : "ready",
  );

  const runDecision = React.useCallback(() => {
    if (!userId) {
      setPhase("ready");
      return;
    }

    beginSessionCreditsWarmup(userId, useAuthStore.getState().profile);
    runSessionPreload(userId, useAuthStore.getState().profile);

    const hasPendingCookie = pendingLoginIntro || readIntroPendingCookie();
    const seenSession = readSessionIntroSeen();
    const onboardingIntroPending = readOnboardingIntroPending(userId);

    const decision = decideSessionIntro({
      userId,
      pendingLoginIntro,
      hasPendingCookie,
      sessionIntroSeen: seenSession,
      onboardingIntroPending,
    });

    logIntroDecision(email, {
      userId,
      hasPendingCookie,
      seenSession,
      shouldShow: decision.shouldShow,
      reason: decision.reason,
      appVisible: !decision.shouldShow,
    });

    if (decision.shouldShow) {
      preloadIntroReferenceImages();
      if (hasPendingCookie) {
        try {
          sessionStorage.removeItem("vodex_intro_seen_session");
        } catch {
          /* ignore */
        }
      }
      clearIntroPendingCookie();
      setPhase("intro");
    } else {
      setPhase("ready");
    }
  }, [userId, pendingLoginIntro, email]);

  React.useLayoutEffect(() => {
    runDecision();
  }, [runDecision, pathname]);

  React.useEffect(() => {
    registerIntroDebugHook(() => {
      setPhase("intro");
    });
  }, []);

  const onIntroVisible = React.useCallback(() => {
    markSessionIntroSeen();
    if (userId) clearOnboardingIntroPending(userId);
    clearIntroPendingCookie();
  }, [userId]);

  const finishIntro = React.useCallback(() => {
    markSessionIntroSeen();
    if (userId) clearOnboardingIntroPending(userId);
    clearIntroPendingCookie();
    setPhase("ready");
  }, [userId]);

  const appVisible = phase === "ready";
  const showIntroOverlay = phase === "intro";

  return (
    <>
      <div
        className={
          appVisible
            ? undefined
            : "pointer-events-none invisible fixed inset-0 z-0 overflow-hidden opacity-0"
        }
        aria-hidden={!appVisible}
        data-testid={appVisible ? "vodex-app-visible" : "vodex-app-preload"}
      >
        {children}
      </div>
      {showIntroOverlay ? (
        <VodexSessionIntro show onVisible={onIntroVisible} onDone={finishIntro} />
      ) : phase === "deciding" ? (
        <div
          className="fixed inset-0 z-[9998] bg-background"
          data-testid="vodex-session-intro-deciding"
          aria-hidden
        />
      ) : null}
    </>
  );
}
