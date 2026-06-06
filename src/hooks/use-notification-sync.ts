"use client";

import * as React from "react";
import { refreshUserNotificationsFromApi } from "@/lib/notifications/refresh-user-notifications";

const POLL_MS = 8_000;

/** Keeps notification badge + list synced on mobile/desktop without opening the panel. */
export function useNotificationSync(enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      void refreshUserNotificationsFromApi({ playSoundOnNew: true });
    };

    refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);
}
