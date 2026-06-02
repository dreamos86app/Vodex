"use client";

import * as React from "react";
import {
  VodexSessionIntro,
  markSessionIntroSeen,
  shouldShowSessionIntro,
} from "@/components/session/vodex-session-intro";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useOnboardingComplete } from "@/hooks/use-onboarding-complete";
import { runSessionPreload } from "@/lib/bootstrap/session-preload";
import { beginSessionCreditsWarmup } from "@/lib/credits/session-credits-warmup";
import { isLightweightPublicPath } from "@/lib/routing/lightweight-public-paths";
import { hasActiveSession } from "@/lib/auth/client-identity";
import { usePathname } from "next/navigation";

type EntryPhase = "boot" | "intro" | "ready";

/**
 * Session entry: VODEX intro on first visit per tab, app + credits preload behind overlay.
 */
export function VodexSessionIntroGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const loading = useAuthStore((s) => s.loading);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { complete, checking } = useOnboardingComplete();

  const [phase, setPhase] = React.useState<EntryPhase>("boot");
  const [mounted, setMounted] = React.useState(false);
  const [checkTimedOut, setCheckTimedOut] = React.useState(false);

  const userId = user?.id ?? profile?.id ?? null;
  const sessionActive = hasActiveSession(session, user);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => setCheckTimedOut(true), 2_000);
    return () => window.clearTimeout(t);
  }, []);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    if (isLightweightPublicPath(pathname)) {
      setPhase("ready");
      return;
    }

    if (userId) {
      beginSessionCreditsWarmup(userId, profile);
    }

    if (!sessionActive && !userId) {
      setPhase("ready");
      return;
    }

    if (checking && !complete && !checkTimedOut) return;

    if (!complete) {
      setPhase("ready");
      return;
    }

    if (shouldShowSessionIntro()) {
      setPhase("intro");
    } else {
      setPhase("ready");
    }
  }, [mounted, pathname, userId, profile, sessionActive, complete, checking, checkTimedOut]);

  React.useEffect(() => {
    if (phase !== "intro" || !userId) return;
    runSessionPreload(userId, profile);
  }, [phase, userId, profile]);

  const finishIntro = React.useCallback(() => {
    markSessionIntroSeen();
    setPhase("ready");
  }, []);

  const showIntroOverlay = mounted && phase === "intro";
  const hideApp = phase === "boot" || phase === "intro";

  return (
    <>
      <div
        className={hideApp ? "pointer-events-none invisible fixed inset-0 overflow-hidden" : undefined}
        aria-hidden={hideApp}
      >
        {children}
      </div>
      {showIntroOverlay ? <VodexSessionIntro show onDone={finishIntro} /> : null}
      {mounted && phase === "boot" && sessionActive ? (
        <div
          className="fixed inset-0 z-[199] flex items-center justify-center bg-background"
          aria-hidden
        >
          <p className="sr-only">Loading Vodex</p>
        </div>
      ) : null}
    </>
  );
}
