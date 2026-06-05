"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { BANNER_TEMPLATES, type BannerTemplateId } from "@/lib/status/announcement-templates";
import { STATUS_SCHEMA_INSTALL_HINT } from "@/lib/status/status-db";
import {
  DEFAULT_BANNER_DESIGN,
  type MessageDesign,
} from "@/lib/control-center/message-design-presets";
import { MessageDesignFields } from "@/components/control-center/message-design-fields";
import { TopbarBannerPreview } from "@/components/control-center/topbar-banner-preview";
import { sanitizeAdminUrl } from "@/lib/control-center/sanitize-url";

type AnnRow = {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  priority: number;
  banner_type: string;
};

type TargetPlan = "all" | "free" | "starter" | "pro" | "infinity";

export function AdminAnnouncementsPanel() {
  const [schemaReady, setSchemaReady] = React.useState<boolean | null>(null);
  const [schemaDegraded, setSchemaDegraded] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const [announcements, setAnnouncements] = React.useState<AnnRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<BannerTemplateId>(BANNER_TEMPLATES[0]!.id);
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [priority, setPriority] = React.useState(100);
  const [targetEmail, setTargetEmail] = React.useState("");
  const [targetPlan, setTargetPlan] = React.useState<TargetPlan>("all");
  const [design, setDesign] = React.useState<MessageDesign>(DEFAULT_BANNER_DESIGN);

  const load = React.useCallback(async (refreshSchema = false) => {
    const url = refreshSchema
      ? "/api/admin/status/overview?refresh=1"
      : "/api/admin/status/overview";
    const res = await fetch(url, { credentials: "include" });
    const json = (await res.json()) as {
      schemaReady?: boolean;
      schemaDegraded?: boolean;
      hint?: string | null;
      announcements?: AnnRow[];
    };
    setSchemaReady(Boolean(json.schemaReady));
    setSchemaDegraded(Boolean(json.schemaDegraded));
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
    setPriority(tpl.priority);
    setDesign({
      ...DEFAULT_BANNER_DESIGN,
      textColor: tpl.textColor ?? "#ffffff",
      accentColor: tpl.textColor ?? "#ffffff",
    });
  }, [templateId]);

  async function publish() {
    const activeCount = announcements.filter((a) => a.is_active).length;
    if (activeCount >= 2) {
      toast.error("Max 2 active banners. Deactivate one first.");
      return;
    }
    setBusy(true);
    try {
      const safeUrl = sanitizeAdminUrl(linkUrl);
      const res = await fetch("/api/admin/status/announcements/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template: templateId,
          title: title.trim(),
          message: message.trim(),
          linkLabel: linkLabel.trim() || undefined,
          linkUrl: safeUrl ?? undefined,
          priority,
          targetEmail: targetEmail.trim() || undefined,
          targetPlan: targetEmail.trim() ? undefined : targetPlan,
          design,
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px]"
            onClick={() => void load(true)}
          >
            Refresh schema check
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px]"
            onClick={() => void load(false)}
          >
            Retry load
          </button>
        </div>
      </div>
    );
  }

  const activeCount = announcements.filter((a) => a.is_active).length;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4" data-testid="admin-announcements-panel">
      {schemaDegraded && hint ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
          {hint}
        </div>
      ) : null}
      <div>
        <h3 className="text-[14px] font-semibold">Top-bar alerts</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Long horizontal banner at the top of the app. Max 2 active. Preview matches live banner height.
        </p>
        {activeCount > 0 ? (
          <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {activeCount} active (max 2)
          </p>
        ) : null}
      </div>

      <TopbarBannerPreview
        title={title}
        message={message}
        linkLabel={linkLabel}
        design={design}
      />

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
        <select
          value={targetPlan}
          onChange={(e) => setTargetPlan(e.target.value as TargetPlan)}
          disabled={Boolean(targetEmail.trim())}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2 disabled:opacity-50"
        >
          <option value="all">All users</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="infinity">Infinity (all tiers)</option>
        </select>
        <input
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          placeholder="Specific email (optional)"
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
          placeholder="https:// or /path"
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
        />
      </div>

      <MessageDesignFields
        design={design}
        onChange={setDesign}
        onReset={() => {
          const tpl = BANNER_TEMPLATES.find((t) => t.id === templateId);
          if (tpl) setDesign({ ...DEFAULT_BANNER_DESIGN, textColor: tpl.textColor ?? "#ffffff" });
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => void publish()}
        className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
      >
        Publish announcement
      </button>

      {announcements.filter((a) => a.is_active).length > 0 ? (
        <ul className="space-y-2 border-t border-border pt-4">
          {announcements
            .filter((a) => a.is_active)
            .map((a) => (
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
                onClick={() => void toggleAnnouncement(a.id, false)}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-destructive"
              >
                Deactivate
              </button>
            </li>
          ))}
        </ul>
      ) : announcements.length > 0 ? (
        <p className="border-t border-border pt-4 text-[11px] text-muted-foreground">
          No active alerts. Publish a new one above to show the top bar banner.
        </p>
      ) : null}
    </div>
  );
}
