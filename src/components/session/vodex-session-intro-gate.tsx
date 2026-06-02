"use client";

import * as React from "react";
import {
  VodexSessionIntro,
  markSessionIntroSeen,
  shouldShowSessionIntro,
} from "@/components/session/vodex-session-intro";
import { useAuthStore } from "@/lib/stores/auth-store";
import { runSessionPreload } from "@/lib/bootstrap/session-preload";
import { beginSessionCreditsWarmup } from "@/lib/credits/session-credits-warmup";
import { isLightweightPublicPath } from "@/lib/routing/lightweight-public-paths";
import { hasActiveSession } from "@/lib/auth/client-identity";
import { usePathname } from "next/navigation";

type EntryPhase = "intro" | "ready";

/**
 * Session entry: VODEX intro on first visit per tab (or after fresh login).
 * App mounts behind overlay; credits warm from server snapshot + lite fetch.
 */
export function VodexSessionIntroGate({
  children,
  serverUserId,
  pendingLoginIntro = false,
}: {
  children: React.ReactNode;
  serverUserId?: string;
  /** Set by auth callback cookie — forces intro once after login. */
  pendingLoginIntro?: boolean;
}) {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const profileId = useAuthStore((s) => s.profile?.id);
  const profilePlanId = useAuthStore((s) => s.profile?.plan_id);

  const userId = serverUserId ?? user?.id ?? profileId ?? null;
  const sessionActive = hasActiveSession(session, user) || Boolean(serverUserId);

  const [phase, setPhase] = React.useState<EntryPhase>(() =>
    pendingLoginIntro ? "intro" : "ready",
  );

  React.useLayoutEffect(() => {
    if (isLightweightPublicPath(pathname) || !userId) {
      setPhase("ready");
      return;
    }

    beginSessionCreditsWarmup(userId, useAuthStore.getState().profile);
    runSessionPreload(userId, useAuthStore.getState().profile);

    const showIntro =
      pendingLoginIntro || (sessionActive && shouldShowSessionIntro());

    if (showIntro) {
      if (pendingLoginIntro) {
        try {
          sessionStorage.removeItem("vodex_intro_seen_session");
        } catch {
          /* ignore */
        }
      }
      setPhase("intro");
    } else {
      setPhase("ready");
    }
  }, [pathname, userId, sessionActive, pendingLoginIntro, profilePlanId]);

  const finishIntro = React.useCallback(() => {
    markSessionIntroSeen();
    setPhase("ready");
    try {
      document.cookie = "vodex_session_intro_pending=; Max-Age=0; path=/";
    } catch {
      /* ignore */
    }
  }, []);

  const showIntroOverlay = phase === "intro";

  return (
    <>
      <div
        className={
          showIntroOverlay
            ? "pointer-events-none invisible fixed inset-0 z-0 overflow-hidden"
            : undefined
        }
        aria-hidden={showIntroOverlay}
      >
        {children}
      </div>
      {showIntroOverlay ? (
        <VodexSessionIntro show onDone={finishIntro} />
      ) : null}
    </>
  );
}
