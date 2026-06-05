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
  const cls = "size-3.5 shrink-0 opacity-95";
  if (type === "sparkles") return <Sparkles className={cls} strokeWidth={2} />;
  if (type === "wrench") return <Wrench className={cls} strokeWidth={2} />;
  if (type === "info") return <Info className={cls} strokeWidth={2} />;
  return <AlertTriangle className={cls} strokeWidth={2} />;
}

export function PlatformAnnouncementBanners() {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const [ready, setReady] = React.useState(false);

  const load = React.useCallback(() => {
    return fetch("/api/platform/active-announcements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { announcements?: Announcement[] } | null) => {
        if (!json?.announcements) return;
        setAnnouncements(json.announcements.slice(0, 2));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  React.useEffect(() => {
    setDismissed(readDismissed());
    void load();
    const poll = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(poll);
  }, [load]);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (!ready || visible.length === 0) return null;

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
          const linkLabel = a.link_label?.trim() || "Status";

          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="border-b border-black/10 px-2 py-1.5 sm:px-3"
              style={{
                background: `linear-gradient(90deg, ${from}, ${to})`,
                color: textColor,
              }}
              role="alert"
            >
              <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-2.5">
                <BannerIcon type={a.icon_type ?? type} />
                <p className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight sm:text-[12px]">
                  <span>{a.title}</span>
                  {a.message ? (
                    <span className="hidden font-normal opacity-90 sm:inline">
                      {" "}
                      · {a.message}
                    </span>
                  ) : null}
                </p>
                {a.link_label || a.link_url ? (
                  <Link
                    href={href}
                    className="hidden shrink-0 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#2563eb] shadow-sm sm:inline-flex"
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {linkLabel}
                  </Link>
                ) : null}
                <button
                  type="button"
                  aria-label="Dismiss for this session"
                  className="shrink-0 rounded p-0.5 hover:bg-black/10"
                  onClick={() => {
                    const next = new Set(dismissed);
                    next.add(a.id);
                    setDismissed(next);
                    writeDismissed(next);
                  }}
                >
                  <X className="size-3.5" />
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
