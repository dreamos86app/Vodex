"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

const DISMISS_KEY = "vodex_platform_announcement_dismissed";

type Announcement = {
  id: string;
  title: string;
  message: string;
  severity: string;
  link_label: string | null;
  link_url: string | null;
};

export function PlatformIncidentBanner() {
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/active-announcement")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { announcement?: Announcement | null } | null) => {
        if (cancelled || !json?.announcement) return;
        try {
          const raw = sessionStorage.getItem(DISMISS_KEY);
          if (raw === json.announcement.id) {
            setDismissed(true);
            return;
          }
        } catch {
          /* ignore */
        }
        setAnnouncement(json.announcement);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  const statusHref =
    announcement.link_url?.startsWith("http") ? announcement.link_url : "https://status.vodex.dev";

  return (
    <div
      className="relative z-[60] border-b border-red-900/30 bg-gradient-to-r from-red-700 via-red-600 to-rose-700 px-4 py-2.5 text-white shadow-md"
      data-testid="platform-incident-banner"
      role="alert"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <div className="min-w-0 flex-1 text-[12px] leading-relaxed sm:text-[13px]">
          <p className="font-semibold">{announcement.title}</p>
          <p className="mt-0.5 text-white/90">{announcement.message}</p>
          <Link
            href={statusHref}
            className="mt-1 inline-block font-semibold underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {announcement.link_label ?? "Status page"}
          </Link>
        </div>
        <button
          type="button"
          aria-label="Dismiss for this session"
          className="shrink-0 rounded-md p-1 hover:bg-white/15"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, announcement.id);
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
