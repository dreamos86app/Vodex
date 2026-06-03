"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { BANNER_TEMPLATES, type BannerTemplateId } from "@/lib/status/announcement-templates";
import { STATUS_SCHEMA_INSTALL_HINT } from "@/lib/status/status-db";

type AnnRow = {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  priority: number;
  banner_type: string;
};

export function AdminAnnouncementsPanel() {
  const [schemaReady, setSchemaReady] = React.useState<boolean | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [announcements, setAnnouncements] = React.useState<AnnRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<BannerTemplateId>(BANNER_TEMPLATES[0]!.id);
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [gradientFrom, setGradientFrom] = React.useState("#DC2626");
  const [gradientTo, setGradientTo] = React.useState("#EF4444");
  const [priority, setPriority] = React.useState(100);
  const [targetEmail, setTargetEmail] = React.useState("");

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/status/overview", { credentials: "include" });
    const json = await res.json();
    setSchemaReady(Boolean(json.schemaReady));
    setHint(json.hint ?? null);
    setAnnouncements(json.announcements ?? []);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const tpl = BANNER_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setMessage(tpl.message);
    setLinkLabel(tpl.linkLabel);
    setLinkUrl(tpl.linkUrl);
    setGradientFrom(tpl.gradientFrom);
    setGradientTo(tpl.gradientTo);
    setPriority(tpl.priority);
  }, [templateId]);

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template: templateId,
          title: title.trim(),
          message: message.trim(),
          linkLabel: linkLabel.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          gradientFrom,
          gradientTo,
          priority,
          targetEmail: targetEmail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      toast.success("Announcement published");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAnnouncement(id: string, active: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, isActive: active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (schemaReady === false) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4" data-testid="admin-announcements-schema-warning">
        <h3 className="text-[14px] font-semibold text-amber-900 dark:text-amber-100">Announcement tables not ready</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-amber-950/80 dark:text-amber-100/80">
          {hint ?? STATUS_SCHEMA_INSTALL_HINT}
        </p>
      </div>
    );
  }

  const activeCount = announcements.filter((a) => a.is_active).length;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4" data-testid="admin-announcements-panel">
      <div>
        <h3 className="text-[14px] font-semibold">Admin announcements (top bar)</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Visible banner at the top of the app. Max 2 active at once. Link text is clickable for users.
        </p>
        {activeCount > 0 ? (
          <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {activeCount} active banner{activeCount !== 1 ? "s" : ""} (max 2 shown)
          </p>
        ) : null}
      </div>

      <div
        className="overflow-hidden rounded-xl px-4 py-3 text-[13px] text-white shadow-md"
        style={{ background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
        data-testid="admin-announcement-preview"
      >
        <p className="font-semibold">{title || "Announcement title"}</p>
        <p className="mt-1 text-[12px] opacity-95">
          {message || "Message preview"}{" "}
          {linkLabel && linkUrl ? (
            <span className="underline underline-offset-2">{linkLabel}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value as BannerTemplateId)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
        >
          {BANNER_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          placeholder="Target email (optional — blank = everyone)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
        />
        <input
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Link label"
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void publish()}
          className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          Publish announcement
        </button>
      </div>

      {announcements.length > 0 ? (
        <ul className="space-y-2 border-t border-border pt-4">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 text-[12px]"
            >
              <span className="font-medium">
                {a.title}{" "}
                <span className="text-muted-foreground">
                  (p{a.priority} · {a.banner_type})
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleAnnouncement(a.id, !a.is_active)}
                className="rounded-md border border-border px-2 py-1 text-[11px]"
              >
                {a.is_active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
