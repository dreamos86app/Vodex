"use client";

import * as React from "react";
import { Bell, Megaphone, Rocket, AlertTriangle, Sparkles, Wrench, Gift, Users, Plug, Layers, type LucideIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { INBOX_MESSAGE_TEMPLATES } from "@/lib/notifications/inbox-message-templates";

const ICON_MAP: Record<string, LucideIcon> = {
  bell: Bell,
  megaphone: Megaphone,
  rocket: Rocket,
  alert: AlertTriangle,
  gift: Gift,
  wrench: Wrench,
  sparkles: Sparkles,
  users: Users,
  plug: Plug,
  layers: Layers,
};

const EFFECT_CLASS: Record<string, string> = {
  glow: "from-sky-500/20 via-indigo-500/10 to-violet-500/20",
  stars: "from-sky-50/90 via-indigo-50/80 to-violet-100/70 dark:from-slate-900/80 dark:via-indigo-950/40 dark:to-violet-950/30",
  frost: "from-cyan-500/15 via-sky-400/10 to-blue-500/15",
};

function InboxPreviewCard({
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
      className={`relative w-full max-w-[340px] overflow-hidden rounded-xl border border-sky-200/60 bg-gradient-to-br p-3.5 dark:border-sky-500/30 ${effect}`}
      data-testid="admin-inbox-preview"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md">
          <Icon className="size-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold leading-snug text-foreground">{title || "Title"}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {message || "Message body"}
          </p>
        </div>
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
      </div>
    </div>
  );
}

type TargetPlan = "all" | "free" | "starter" | "pro" | "infinity";

export function AdminInboxMessagesPanel() {
  const [templateId, setTemplateId] = React.useState(INBOX_MESSAGE_TEMPLATES[0]!.id);
  const [title, setTitle] = React.useState(INBOX_MESSAGE_TEMPLATES[0]!.title);
  const [message, setMessage] = React.useState(INBOX_MESSAGE_TEMPLATES[0]!.body);
  const [iconKey, setIconKey] = React.useState(INBOX_MESSAGE_TEMPLATES[0]!.iconKey);
  const [effectKey, setEffectKey] = React.useState(INBOX_MESSAGE_TEMPLATES[0]!.effectKey);
  const [targetEmail, setTargetEmail] = React.useState("");
  const [targetPlan, setTargetPlan] = React.useState<TargetPlan>("all");
  const [actionUrl, setActionUrl] = React.useState("/");
  const [playSound, setPlaySound] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = INBOX_MESSAGE_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setTitle(t.title);
    setMessage(t.body);
    setIconKey(t.iconKey);
    setEffectKey(t.effectKey);
  }, [templateId]);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetEmail: targetEmail.trim() || undefined,
          targetPlan: targetEmail.trim() ? undefined : targetPlan,
          actionUrl: actionUrl.trim() || undefined,
          templateId,
          iconKey,
          effectKey,
          playSound,
          category: "system",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(`Inbox message sent to ${json.recipientCount} user(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4" data-testid="admin-inbox-messages">
      <h3 className="text-[14px] font-semibold">User inbox messages</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Sends to the in-app notification bell only — not email. Preview matches the user popover card.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          >
            {INBOX_MESSAGE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={targetPlan}
            onChange={(e) => setTargetPlan(e.target.value as TargetPlan)}
            disabled={Boolean(targetEmail.trim())}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] disabled:opacity-50"
          >
            <option value="all">All users</option>
            <option value="free">Free plan</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="infinity">Infinity</option>
          </select>
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Specific email (overrides plan)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <input
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
            placeholder="Action URL (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={playSound} onChange={(e) => setPlaySound(e.target.checked)} />
            Play in-web sound (if user enabled sounds in settings)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="rounded-lg bg-accent px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
            data-testid="admin-send-inbox-message"
          >
            {busy ? "Sending…" : "Send inbox message"}
          </button>
        </div>
        <InboxPreviewCard title={title} message={message} iconKey={iconKey} effectKey={effectKey} />
      </div>
    </div>
  );
}
