"use client";

import * as React from "react";
import { usePresenceStore } from "@/lib/stores/presence-store";
import type { PresenceMode, VisiblePresenceStatus } from "@/lib/presence/user-presence";

const HEARTBEAT_MS = 50_000;
const MIN_GAP_MS = 8_000;

type MeResponse = {
  presenceMode: PresenceMode;
  visibleStatus: VisiblePresenceStatus;
  label: string;
};

async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch("/api/user/presence/me", { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

async function postHeartbeat(): Promise<boolean> {
  try {
    const res = await fetch("/api/user/presence/heartbeat", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as MeResponse & { ok?: boolean };
    usePresenceStore.getState().setSnapshot({
      presenceMode: json.presenceMode,
      visibleStatus: json.visibleStatus,
      label: json.label,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Keeps the signed-in user's presence fresh while the tab is visible.
 */
export function usePresenceHeartbeat(enabled: boolean) {
  const lastBeatRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);

  const beat = React.useCallback(async (force = false) => {
    if (!enabled) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const now = Date.now();
    if (!force && now - lastBeatRef.current < MIN_GAP_MS) return;
    lastBeatRef.current = now;
    await postHeartbeat();
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      usePresenceStore.getState().reset();
      return;
    }

    let cancelled = false;

    void (async () => {
      const me = await fetchMe();
      if (cancelled || !me) return;
      usePresenceStore.getState().setSnapshot(me);
      await beat(true);
    })();

    const onVisibility = () => {
      if (!document.hidden) void beat(true);
    };
    const onFocus = () => {
      void beat(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    timerRef.current = window.setInterval(() => {
      void beat(false);
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, [enabled, beat]);
}
