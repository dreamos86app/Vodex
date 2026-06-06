"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  backgroundClass,
  DEFAULT_BANNER_DESIGN,
  effectOverlayClass,
  messageDesignSurfaceClass,
  type BackgroundPresetId,
  type EffectPresetId,
  type IconPresetId,
  type MessageDesign,
} from "@/lib/control-center/message-design-presets";
import { MessageDesignIcon } from "@/components/control-center/message-design-icon";
import {
  usePlatformAnnouncementsSync,
  type LiveAnnouncement,
} from "@/hooks/use-platform-announcements-sync";

const DISMISS_KEY = "vodex_platform_announcements_dismissed";

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

function announcementDesign(a: LiveAnnouncement): MessageDesign {
  const bg =
    (a.background_preset as BackgroundPresetId | null) ??
    DEFAULT_BANNER_DESIGN.backgroundPreset;
  const effect =
    (a.effect_preset as EffectPresetId | null) ??
    (a.effect_key as EffectPresetId | null) ??
    DEFAULT_BANNER_DESIGN.effectPreset;
  const icon =
    (a.icon_preset as IconPresetId | null) ??
    (a.icon_type as IconPresetId | null) ??
    DEFAULT_BANNER_DESIGN.iconPreset;

  return {
    backgroundPreset: bg,
    effectPreset: effect,
    iconPreset: icon,
    animatedIconEnabled: Boolean(a.animated_icon_enabled),
    textColor: a.text_color ?? DEFAULT_BANNER_DESIGN.textColor,
    accentColor: a.accent_color ?? DEFAULT_BANNER_DESIGN.accentColor,
    outlineColor: a.outline_color ?? DEFAULT_BANNER_DESIGN.outlineColor,
    buttonColor: a.button_color ?? DEFAULT_BANNER_DESIGN.buttonColor,
  };
}

function AnnouncementBanner({ a, onDismiss }: { a: LiveAnnouncement; onDismiss: () => void }) {
  const design = announcementDesign(a);
  const effectCls = effectOverlayClass(design.effectPreset);
  const href =
    a.link_url?.startsWith("http") || a.link_url?.startsWith("/")
      ? a.link_url
      : null;
  const linkLabel = a.link_label?.trim() || "Learn more";
  const showLink = Boolean(href && (a.link_label || a.link_url));

  const legacyGradient =
    !a.background_preset && a.gradient_from && a.gradient_to
      ? { background: `linear-gradient(90deg, ${a.gradient_from}, ${a.gradient_to})` }
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="border-b border-black/10"
      role="alert"
    >
      <div
        className={cn(
          "mx-auto max-w-6xl px-3 py-2 sm:px-4 sm:py-2.5",
          !legacyGradient && messageDesignSurfaceClass(effectCls),
          !legacyGradient && backgroundClass(design.backgroundPreset),
          effectCls,
        )}
        style={{
          ...legacyGradient,
          color: design.textColor,
          outline: design.outlineColor ? `1px solid ${design.outlineColor}` : undefined,
        }}
      >
        <div className="relative z-[1] flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
            <MessageDesignIcon
              preset={design.iconPreset}
              animated={design.animatedIconEnabled}
              size="sm"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[12px] font-semibold leading-snug sm:text-[13px]">{a.title}</p>
              {a.message ? (
                <p className="text-[11px] leading-snug opacity-95 sm:text-[12px]">{a.message}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
            {showLink && href ? (
              <Link
                href={href}
                className="inline-flex min-h-8 items-center justify-center rounded-md px-3 py-1 text-[11px] font-semibold shadow-sm sm:text-[12px]"
                style={{
                  backgroundColor: design.buttonColor ?? "rgba(255,255,255,0.95)",
                  color: design.accentColor ?? "#2563eb",
                }}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {linkLabel}
              </Link>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss for this session"
              className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10"
              onClick={onDismiss}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PlatformAnnouncementBanners() {
  const { announcements, ready } = usePlatformAnnouncementsSync();
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (!ready || visible.length === 0) return null;

  return (
    <div className="relative z-[60] flex flex-col" data-testid="platform-incident-banner">
      <AnimatePresence initial={false}>
        {visible.map((a) => (
          <AnnouncementBanner
            key={a.id}
            a={a}
            onDismiss={() => {
              const next = new Set(dismissed);
              next.add(a.id);
              setDismissed(next);
              writeDismissed(next);
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** @deprecated Use PlatformAnnouncementBanners */
export const PlatformIncidentBanner = PlatformAnnouncementBanners;
