"use client";

import { useEffect, useRef } from "react";
import { useIdleReady } from "@/lib/hooks/use-idle-ready";
import { subscribeCreditUpdated } from "@/lib/credits/credit-events-client";
import {
  CREDITS_BACKGROUND_STALE_MS,
  useCreditsStore,
} from "@/lib/stores/credits-store";

/**
 * Single app-wide credits sync — prevents duplicate /api/credits spam from
 * multiple components each subscribing and refetching independently.
 */
export function useCreditsSync(enabled: boolean) {
  const idleReady = useIdleReady(180);
  const applyCanonical = useCreditsStore((s) => s.applyCanonical);
  const syncFromDB = useCreditsStore((s) => s.syncFromDB);
  const bootstrapped = useRef(false);
  const lastEnabled = useRef(false);
  const syncEnabled = enabled && idleReady;

  useEffect(() => {
    return subscribeCreditUpdated((payload) => {
      if (payload) {
        applyCanonical(payload);
        return;
      }
      void syncFromDB({ force: true, reason: "invalidated" });
    });
  }, [applyCanonical, syncFromDB]);

  useEffect(() => {
    if (!syncEnabled) {
      if (!enabled) lastEnabled.current = false;
      return;
    }
    const shouldBootstrap = !bootstrapped.current || !lastEnabled.current;
    lastEnabled.current = true;
    if (!shouldBootstrap) return;
    bootstrapped.current = true;
    void syncFromDB({ reason: "bootstrap" }).then((payload) => {
      if (!payload) {
        void syncFromDB({ force: true, reason: "bootstrap" });
      }
    });
  }, [syncEnabled, enabled, syncFromDB]);

  useEffect(() => {
    if (!syncEnabled) return;

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const { lastSyncedAt, isConfirmed } = useCreditsStore.getState();
      if (!isConfirmed || !lastSyncedAt) return;
      if (Date.now() - lastSyncedAt < CREDITS_BACKGROUND_STALE_MS) return;
      void syncFromDB({ reason: "manual" });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [syncEnabled, syncFromDB]);
}
