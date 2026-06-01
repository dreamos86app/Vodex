"use client";

import * as React from "react";
import { VodexSessionIntro, shouldShowSessionIntro } from "@/components/session/vodex-session-intro";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useOnboardingComplete } from "@/hooks/use-onboarding-complete";
import { runSessionPreload } from "@/lib/bootstrap/session-preload";
import { isLightweightPublicPath } from "@/lib/routing/lightweight-public-paths";
import { usePathname } from "next/navigation";

/**
 * Premium 2.4s intro on first authenticated entry per browser session.
 * Preloads credits/projects behind the overlay; skips internal navigation.
 */
export function VodexSessionIntroGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { complete, checking } = useOnboardingComplete();
  const [introVisible, setIntroVisible] = React.useState(false);
  const [appReady, setAppReady] = React.useState(() => !shouldShowSessionIntro());

  React.useEffect(() => {
    if (isLightweightPublicPath(pathname)) {
      setAppReady(true);
      setIntroVisible(false);
      return;
    }
    if (loading || checking) return;
    if (!user?.id) {
      setAppReady(true);
      setIntroVisible(false);
      return;
    }
    if (!complete) {
      setAppReady(true);
      setIntroVisible(false);
      return;
    }
    if (!shouldShowSessionIntro()) {
      setAppReady(true);
      setIntroVisible(false);
      return;
    }
    setIntroVisible(true);
    setAppReady(false);
    runSessionPreload(user.id, profile);
  }, [loading, checking, user?.id, complete, pathname, profile?.id]);

  const onIntroDone = React.useCallback(() => {
    setIntroVisible(false);
    setAppReady(true);
  }, []);

  return (
    <>
      {introVisible ? <VodexSessionIntro show onDone={onIntroDone} /> : null}
      {appReady ? children : null}
    </>
  );
}
