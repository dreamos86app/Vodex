"use client";

import * as React from "react";
import {
  Bell,
  Megaphone,
  Rocket,
  AlertTriangle,
  Sparkles,
  Wrench,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { AdminSystemStatusPanel } from "@/components/admin/admin-system-status-panel";

const NOTIF_TEMPLATES = [
  {
    id: "discord",
    label: "New Discord community",
    title: "Join the Vodex community",
    message:
      "Our new Discord community is live. Join builders, share launches, and follow product updates.",
    actionLabel: "Join Discord",
    actionUrl: "https://discord.gg/y8EbeMc9Mb",
    icon: "megaphone" as const,
    effect: "stars" as const,
  },
  {
    id: "sale",
    label: "Big sale",
    title: "Limited-time Vodex upgrade offer",
    message:
      "Upgrade now to unlock more build credits, action credits, and premium generation features.",
    actionLabel: "View plans",
    actionUrl: "/pricing",
    icon: "gift" as const,
    effect: "glow" as const,
  },
  {
    id: "system",
    label: "System issue",
    title: "Technical issue affecting Vodex",
    message: "We're aware of an issue affecting some services and are working to resolve it.",
    actionLabel: "Status Page",
    actionUrl: "https://status.vodex.dev",
    icon: "alert" as const,
    effect: "frost" as const,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    title: "Scheduled maintenance",
    message: "Vodex is undergoing scheduled maintenance. Some features may be temporarily unavailable.",
    actionLabel: "View status",
    actionUrl: "https://status.vodex.dev",
    icon: "wrench" as const,
    effect: "frost" as const,
  },
  {
    id: "feature",
    label: "New feature",
    title: "New Vodex improvements are live",
    message:
      "We've shipped improvements to app generation, publishing, and workspace collaboration.",
    actionLabel: "See changelog",
    actionUrl: "/changelog",
    icon: "rocket" as const,
    effect: "stars" as const,
  },
  {
    id: "custom",
    label: "Custom",
    title: "",
    message: "",
    actionLabel: "",
    actionUrl: "",
    icon: "bell" as const,
    effect: "glow" as const,
  },
] as const;

const ICON_MAP: Record<string, LucideIcon> = {
  bell: Bell,
  megaphone: Megaphone,
  rocket: Rocket,
  alert: AlertTriangle,
  gift: Gift,
  wrench: Wrench,
  sparkles: Sparkles,
};

const EFFECT_CLASS: Record<string, string> = {
  glow: "from-sky-500/20 via-indigo-500/10 to-violet-500/20",
  stars: "from-sky-50/90 via-indigo-50/80 to-violet-100/70",
  frost: "from-cyan-500/15 via-sky-400/10 to-blue-500/15",
};

function NotificationPreviewCard({
  title,
  message,
  iconKey,
  effectKey,
}: {
  title: string;
  message: string;
  iconKey: string;
  effectKey: string;
}) {
  const Icon = ICON_MAP[iconKey] ?? Bell;
  const effect = EFFECT_CLASS[effectKey] ?? EFFECT_CLASS.glow;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-sky-200/60 bg-gradient-to-br p-4 dark:border-sky-500/30 ${effect}`}
      data-testid="admin-notification-preview"
    >
      {effectKey === "stars" ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px), radial-gradient(circle, rgb(186 230 253) 1px, transparent 1px)",
            backgroundSize: "42px 42px, 58px 58px",
          }}
        />
      ) : null}
      <div className="relative flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-foreground">{title || "Notification title"}</p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            {message || "Notification message preview"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminControlCenterPanel() {
  const [nTitle, setNTitle] = React.useState<string>(NOTIF_TEMPLATES[0]!.title);
  const [nMessage, setNMessage] = React.useState<string>(NOTIF_TEMPLATES[0]!.message);
  const [nActionLabel, setNActionLabel] = React.useState<string>(NOTIF_TEMPLATES[0]!.actionLabel);
  const [nActionUrl, setNActionUrl] = React.useState<string>(NOTIF_TEMPLATES[0]!.actionUrl);
  const [nEmail, setNEmail] = React.useState("");
  const [nTemplate, setNTemplate] = React.useState<string>(NOTIF_TEMPLATES[0]!.id);
  const [nIcon, setNIcon] = React.useState<string>(NOTIF_TEMPLATES[0]!.icon);
  const [nEffect, setNEffect] = React.useState<string>(NOTIF_TEMPLATES[0]!.effect);
  const [playSound, setPlaySound] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [welcomeBusy, setWelcomeBusy] = React.useState(false);

  const applyTemplate = React.useCallback((id: string) => {
    const t = NOTIF_TEMPLATES.find((x) => x.id === id);
    if (!t || id === "custom") return;
    setNTitle(t.title);
    setNMessage(t.message);
    setNActionLabel(t.actionLabel);
    setNActionUrl(t.actionUrl);
    setNIcon(t.icon);
    setNEffect(t.effect);
  }, []);

  React.useEffect(() => {
    if (nTemplate !== "custom") applyTemplate(nTemplate);
  }, [nTemplate, applyTemplate]);

  function markCustomIfEdited(field: "title" | "message") {
    const tpl = NOTIF_TEMPLATES.find((x) => x.id === nTemplate);
    if (!tpl || nTemplate === "custom") return;
    const edited =
      field === "title"
        ? nTitle !== tpl.title
        : nMessage !== tpl.message;
    if (edited) setNTemplate("custom");
  }

  async function sendBroadcast() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: nTitle.trim(),
          message: nMessage.trim(),
          actionLabel: nActionLabel.trim() || undefined,
          actionUrl: nActionUrl.trim() || undefined,
          targetEmail: nEmail.trim() || undefined,
          category: "system",
          templateId: nTemplate,
          iconKey: nIcon,
          effectKey: nEffect,
          playSound,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(`Sent to ${json.recipientCount} user(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function backfillWelcome() {
    setWelcomeBusy(true);
    try {
      const res = await fetch("/api/admin/notifications/welcome-backfill", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Backfill failed");
      toast.success(`Welcome sent to ${json.createdCount} user(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setWelcomeBusy(false);
    }
  }

  return (
    <div className="space-y-10" data-testid="admin-control-center">
      <div>
        <h2 className="text-[16px] font-semibold">Control Center</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Platform top-bar banners (max 2 active), status page, and in-app notifications with live
          preview before publish.
        </p>
      </div>

      <AdminSystemStatusPanel />

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[14px] font-semibold">Broadcast notification</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Send to one user by email or all existing users. Editing title/message switches template to
          Custom.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(240px,300px)]">
          <div className="space-y-3">
            <select
              value={nTemplate}
              onChange={(e) => setNTemplate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
              data-testid="admin-notification-template-select"
            >
              {NOTIF_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={nEmail}
              onChange={(e) => setNEmail(e.target.value)}
              placeholder="Target email (optional — blank = all users)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            />
            <input
              value={nTitle}
              onChange={(e) => {
                setNTitle(e.target.value);
                markCustomIfEdited("title");
              }}
              placeholder="Title"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            />
            <textarea
              value={nMessage}
              onChange={(e) => {
                setNMessage(e.target.value);
                markCustomIfEdited("message");
              }}
              rows={3}
              placeholder="Message"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-muted-foreground">
                Icon
                <select
                  value={nIcon}
                  onChange={(e) => {
                    setNIcon(e.target.value);
                    setNTemplate("custom");
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
                >
                  {Object.keys(ICON_MAP).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-muted-foreground">
                Background effect
                <select
                  value={nEffect}
                  onChange={(e) => {
                    setNEffect(e.target.value);
                    setNTemplate("custom");
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
                >
                  <option value="glow">Soft glow</option>
                  <option value="stars">Subtle stars</option>
                  <option value="frost">Icy frost</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={playSound}
                onChange={(e) => setPlaySound(e.target.checked)}
              />
              Play sound for users who enabled notification sounds
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendBroadcast()}
              className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              data-testid="admin-send-notification"
            >
              Send notification
            </button>
          </div>
          <NotificationPreviewCard
            title={nTitle}
            message={nMessage}
            iconKey={nIcon}
            effectKey={nEffect}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[14px] font-semibold">Welcome notifications</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Sends the one-time welcome notification (with free credits message) to every user who does
          not have one yet.
        </p>
        <button
          type="button"
          disabled={welcomeBusy}
          onClick={() => void backfillWelcome()}
          className="mt-3 rounded-lg border border-border bg-background px-4 py-2 text-[12px] font-semibold hover:bg-surface-raised disabled:opacity-50"
          data-testid="admin-welcome-backfill"
        >
          {welcomeBusy ? "Sending…" : "Backfill welcome for existing users"}
        </button>
      </div>
    </div>
  );
}
