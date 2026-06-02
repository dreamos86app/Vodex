"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles, Wrench, X, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "vodex_platform_announcements_dismissed";

type Announcement = {
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
};

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function defaultGradient(type: string): [string, string] {
  switch (type) {
    case "sale":
      return ["#2563EB", "#7C3AED"];
    case "maintenance":
      return ["#D97706", "#F59E0B"];
    case "success":
      return ["#059669", "#06B6D4"];
    case "info":
      return ["#2563EB", "#06B6D4"];
    case "warning":
      return ["#DC2626", "#FB7185"];
    default:
      return ["#DC2626", "#EF4444"];
  }
}

function BannerIcon({ type }: { type: string }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (type === "sparkles") return <Sparkles className={cls} strokeWidth={2} />;
  if (type === "wrench") return <Wrench className={cls} strokeWidth={2} />;
  if (type === "info") return <Info className={cls} strokeWidth={2} />;
  return <AlertTriangle className={cls} strokeWidth={2} />;
}

export function PlatformAnnouncementBanners() {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setDismissed(readDismissed());
    let cancelled = false;
    void fetch("/api/platform/active-announcements")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { announcements?: Announcement[] } | null) => {
        if (cancelled || !json?.announcements) return;
        setAnnouncements(json.announcements);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="relative z-[60] flex flex-col" data-testid="platform-incident-banner">
      <AnimatePresence initial={false}>
        {visible.map((a) => {
          const type = a.banner_type ?? a.severity ?? "incident";
          const [from, to] =
            a.gradient_from && a.gradient_to
              ? [a.gradient_from, a.gradient_to]
              : defaultGradient(type);
          const textColor = a.text_color ?? "#ffffff";
          const href =
            a.link_url?.startsWith("http") || a.link_url?.startsWith("/")
              ? a.link_url
              : "https://status.vodex.dev";

          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="border-b border-black/10 px-4 py-2.5 shadow-md"
              style={{
                background: `linear-gradient(90deg, ${from}, ${to})`,
                color: textColor,
              }}
              role="alert"
            >
              <div className="mx-auto flex max-w-6xl items-start gap-3">
                <BannerIcon type={a.icon_type ?? type} />
                <div className="min-w-0 flex-1 text-[12px] leading-relaxed sm:text-[13px]">
                  <p className="font-semibold">{a.title}</p>
                  <p className="mt-0.5 opacity-90">{a.message}</p>
                  {a.link_label ? (
                    <Link
                      href={href}
                      className="mt-1 inline-block font-semibold underline underline-offset-2"
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {a.link_label}
                    </Link>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss for this session"
                  className="shrink-0 rounded-md p-1 hover:bg-black/10"
                  onClick={() => {
                    const next = new Set(dismissed);
                    next.add(a.id);
                    setDismissed(next);
                    writeDismissed(next);
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** @deprecated Use PlatformAnnouncementBanners */
export const PlatformIncidentBanner = PlatformAnnouncementBanners;
