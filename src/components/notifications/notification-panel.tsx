"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Zap,
  AlertCircle,
  CheckCircle2,
  Rocket,
  Users,
  X,
  Settings,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import {
  INBOX_TABS,
  notificationMatchesTab,
  readNotificationKind,
  type NotificationInboxTab,
} from "@/lib/notifications/notification-kinds";
import Link from "next/link";
import { refreshUserNotificationsFromApi } from "@/lib/notifications/refresh-user-notifications";
import {
  backgroundClass,
  effectOverlayClass,
  messageDesignSurfaceClass,
  type BackgroundPresetId,
  type EffectPresetId,
  type IconPresetId,
} from "@/lib/control-center/message-design-presets";
import { MessageDesignIcon } from "@/components/control-center/message-design-icon";

const NOTIF_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  deploy: { icon: Rocket, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  build: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-500/10" },
  invite: { icon: Users, color: "text-violet-600", bg: "bg-violet-500/10" },
  credit: { icon: Zap, color: "text-amber-600", bg: "bg-amber-500/10" },
  ai: { icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" },
  system: { icon: Bell, color: "text-muted-foreground", bg: "bg-surface" },
};

function getMeta(type: string) {
  return NOTIF_META[type] ?? NOTIF_META.system;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function useIsMobilePanel() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

interface NotificationPanelProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ anchorRef, open, onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationsStore();
  const [activeTab, setActiveTab] = React.useState<NotificationInboxTab>("all");
  const [mounted, setMounted] = React.useState(false);
  const isMobile = useIsMobilePanel();

  const filtered = React.useMemo(
    () => notifications.filter((n) => notificationMatchesTab(n, activeTab)),
    [notifications, activeTab],
  );
  const panelRef = React.useRef<HTMLDivElement>(null);
  const tabsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void refreshUserNotificationsFromApi();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const [pos, setPos] = React.useState({ top: 0, right: 0 });
  React.useEffect(() => {
    if (!open || isMobile || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 24, 420);
    const right = Math.max(12, window.innerWidth - rect.right);
    const maxRight = window.innerWidth - width - 12;
    setPos({
      top: rect.bottom + 6,
      right: Math.min(right, maxRight),
    });
  }, [open, anchorRef, isMobile]);

  const panel = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
            <>
              {isMobile ? (
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9998] bg-foreground/20 backdrop-blur-[2px]"
                  aria-label="Close notifications"
                  onClick={onClose}
                />
              ) : null}
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                data-testid="notification-panel"
                className={cn(
                  "z-[9999] overflow-hidden rounded-2xl bg-background shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] ring-1 ring-border",
                  isMobile
                    ? "fixed left-3 right-3 top-[max(calc(env(safe-area-inset-top)+3.25rem),3.5rem)] mx-auto w-auto max-w-[420px]"
                    : "fixed",
                )}
                style={
                  isMobile
                    ? { width: "min(calc(100vw - 24px), 420px)" }
                    : {
                        top: pos.top,
                        right: pos.right,
                        width: "min(calc(100vw - 24px), 420px)",
                      }
                }
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bell className="size-3.5 text-muted-foreground/70" strokeWidth={1.75} />
                    <span className="text-[13px] font-semibold text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        +{unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11.5px] text-muted-foreground transition hover:text-foreground"
                      >
                        <CheckCheck className="size-3.5" strokeWidth={1.75} />
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition hover:bg-surface hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div
                  ref={tabsRef}
                  className="notification-tabs-scroll flex gap-1.5 overflow-x-auto border-b border-border px-2 py-2"
                  data-testid="notification-inbox-tabs"
                >
                  {INBOX_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition",
                        activeTab === t.id
                          ? "bg-accent text-white"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="notification-list-scroll max-h-[min(50vh,380px)] overflow-y-auto overflow-x-hidden">
                  {filtered.length === 0 ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                      <Bell className="size-8 text-muted-foreground/35" strokeWidth={1.5} />
                      <p className="text-[13px] font-medium text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {filtered.slice(0, 25).map((n) => {
                        const meta = getMeta(n.type ?? "system");
                        const Icon = meta.icon;
                        const md = n.metadata as Record<string, unknown> | null;
                        const kind = readNotificationKind(n);
                        const isWelcome =
                          kind === "welcome" ||
                          (typeof n.title === "string" && n.title.startsWith("Welcome to Vodex"));
                        const isPremium = Boolean(md?.premium) || isWelcome;
                        const bgPreset =
                          typeof md?.background_preset === "string"
                            ? (md.background_preset as BackgroundPresetId)
                            : isWelcome
                              ? "soft_blue_white"
                              : null;
                        const effectPreset =
                          typeof md?.effect_key === "string"
                            ? (md.effect_key as EffectPresetId)
                            : isWelcome
                              ? "glow_pulse"
                              : null;
                        const iconPreset =
                          typeof md?.icon_key === "string"
                            ? (md.icon_key as IconPresetId)
                            : isWelcome
                              ? "vodex_welcome"
                              : null;
                        const effectCls = effectPreset ? effectOverlayClass(effectPreset) : null;
                        const actionUrl =
                          typeof n.action_url === "string" && n.action_url.trim()
                            ? n.action_url.trim()
                            : null;
                        const actionExternal =
                          actionUrl?.startsWith("http://") || actionUrl?.startsWith("https://");

                        return (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => markRead(n.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") markRead(n.id);
                            }}
                            className={cn(
                              "flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition hover:bg-surface/60",
                              !n.read && !isPremium && "bg-accent/3",
                              isPremium &&
                                cn(
                                  "mx-2 my-1 rounded-xl border border-sky-200/60 shadow-sm",
                                  bgPreset
                                    ? messageDesignSurfaceClass(effectCls)
                                    : "relative overflow-hidden",
                                  bgPreset
                                    ? backgroundClass(bgPreset)
                                    : "bg-gradient-to-br from-sky-50 via-indigo-50/80 to-violet-100/70 dark:from-slate-900/80 dark:via-indigo-950/40 dark:to-violet-950/30",
                                ),
                            )}
                          >
                            {isPremium && iconPreset ? (
                              <MessageDesignIcon
                                preset={iconPreset}
                                animated={Boolean(md?.animated_icon ?? isWelcome)}
                                size="sm"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                                  meta.bg,
                                )}
                              >
                                <Icon className={cn("size-4", meta.color)} strokeWidth={1.65} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "text-[12.5px] leading-snug",
                                  !n.read ? "font-semibold text-foreground" : "text-foreground/80",
                                )}
                              >
                                {n.title ?? n.type}
                              </p>
                              {n.body && (
                                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                                  {n.body}
                                </p>
                              )}
                              <p className="mt-1 text-[10.5px] text-muted-foreground/60">
                                {relativeTime(n.created_at)}
                              </p>
                              {actionUrl ? (
                                <Link
                                  href={actionUrl}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markRead(n.id);
                                    onClose();
                                  }}
                                  target={actionExternal ? "_blank" : undefined}
                                  rel={actionExternal ? "noopener noreferrer" : undefined}
                                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#2563eb] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                                >
                                  Visit
                                  <ExternalLink className="size-3 opacity-90" strokeWidth={2} />
                                </Link>
                              ) : null}
                            </div>
                            {!n.read && (
                              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-border px-4 py-2.5">
                  <Link
                    href="/settings/notifications"
                    onClick={onClose}
                    className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground transition hover:text-foreground"
                  >
                    <Settings className="size-3.5" strokeWidth={1.65} />
                    In-web sounds
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return panel;
}

export function NotificationBell() {
  const { unreadCount } = useNotificationsStore();
  const [open, setOpen] = React.useState(false);
  const bellRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition hover:bg-surface hover:text-foreground",
          open && "bg-surface text-foreground",
        )}
        aria-label="Notifications"
      >
        <Bell className="size-[17px]" strokeWidth={1.55} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
              className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(220,38,38,0.75)] ring-2 ring-background"
              data-testid="notification-unread-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <NotificationPanel
        anchorRef={bellRef as React.RefObject<HTMLElement>}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
