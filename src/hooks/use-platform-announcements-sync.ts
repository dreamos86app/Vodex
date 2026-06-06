"use client";

import * as React from "react";

export type LiveAnnouncement = {
  id: string;
  title: string;
  message: string;
  severity: string;
  link_label: string | null;
  link_url: string | null;
  priority?: number;
  banner_type?: string;
  gradient_from?: string | null;
  gradient_to?: string | null;
  text_color?: string | null;
  icon_type?: string | null;
  background_preset?: string | null;
  effect_preset?: string | null;
  effect_key?: string | null;
  icon_preset?: string | null;
  animated_icon_enabled?: boolean | null;
  accent_color?: string | null;
  outline_color?: string | null;
  button_color?: string | null;
};

const POLL_MS = 12_000;

export function usePlatformAnnouncementsSync() {
  const [announcements, setAnnouncements] = React.useState<LiveAnnouncement[]>([]);
  const [ready, setReady] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/platform/active-announcements", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { announcements?: LiveAnnouncement[] };
      setAnnouncements((json.announcements ?? []).slice(0, 2));
      setReady(true);
    } catch {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", () => void load());

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { announcements, ready, reload: load };
}
