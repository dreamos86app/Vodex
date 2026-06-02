"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { BANNER_TEMPLATES } from "@/lib/status/announcement-templates";
import { STATUS_SCHEMA_INSTALL_HINT } from "@/lib/status/status-db";
import type { StatusLevel } from "@/lib/status/status-types";

const STATUS_OPTIONS: StatusLevel[] = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
];

type CompRow = {
  key: string;
  name: string;
  group_name: string;
  current_status: StatusLevel;
};

type AnnRow = {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  priority: number;
  banner_type: string;
  gradient_from: string | null;
  gradient_to: string | null;
};

export function AdminSystemStatusPanel() {
  const [schemaReady, setSchemaReady] = React.useState<boolean | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [components, setComponents] = React.useState<CompRow[]>([]);
  const [announcements, setAnnouncements] = React.useState<AnnRow[]>([]);
  const [templateId, setTemplateId] = React.useState<string>(BANNER_TEMPLATES[0]!.id);
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [gradientFrom, setGradientFrom] = React.useState("#DC2626");
  const [gradientTo, setGradientTo] = React.useState("#EF4444");
  const [priority, setPriority] = React.useState(100);
  const [incidentTitle, setIncidentTitle] = React.useState("");
  const [incidentMessage, setIncidentMessage] = React.useState("");
  const [incidentComponent, setIncidentComponent] = React.useState("ai_builder");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/status/overview", { credentials: "include" });
      const json = await res.json();
      setSchemaReady(Boolean(json.schemaReady));
      setHint(json.hint ?? null);
      if (json.components) {
        setComponents(
          json.components.map((c: CompRow & { group_name: string }) => ({
            key: c.key,
            name: c.name,
            group_name: c.group_name,
            current_status: c.current_status,
          })),
        );
      }
      if (json.announcements) setAnnouncements(json.announcements);
    } catch {
      setSchemaReady(false);
      setHint(STATUS_SCHEMA_INSTALL_HINT);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const tpl = BANNER_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setMessage(tpl.message);
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
          title: title.trim() || undefined,
          message: message.trim() || undefined,
          gradientFrom,
          gradientTo,
          priority,
          deactivateOthers: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      toast.success("Banner published");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAnnouncement(id: string, isActive: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success(isActive ? "Banner activated" : "Banner deactivated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function unpublishAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/unpublish", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Unpublish failed");
      toast.success("All banners deactivated");
      await load();
    } catch {
      toast.error("Unpublish failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateComponent(key: string, currentStatus: StatusLevel) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/components/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, currentStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setComponents((prev) =>
        prev.map((c) => (c.key === key ? { ...c, current_status: currentStatus } : c)),
      );
      toast.success(`${key} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function createIncident() {
    const t = incidentTitle.trim();
    const m = incidentMessage.trim();
    if (!t || !m) {
      toast.error("Incident title and message required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/incidents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: t,
          message: m,
          affectedComponents: [incidentComponent],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success("Incident created");
      setIncidentTitle("");
      setIncidentMessage("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Loading system status…</p>;
  }

  if (schemaReady === false) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <h3 className="text-[14px] font-semibold text-amber-900">Status tables not installed</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-amber-950/80">
          {hint ?? STATUS_SCHEMA_INSTALL_HINT}
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px]"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
    );
  }

  const grouped = components.reduce<Record<string, CompRow[]>>((acc, c) => {
    const g = c.group_name || "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          <a className="underline" href="/status">
            /status
          </a>{" "}
          ·{" "}
          <a className="underline" href="https://status.vodex.dev" target="_blank" rel="noreferrer">
            status.vodex.dev
          </a>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-lg border border-border px-3 py-1.5 text-[12px]"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[14px] font-semibold">Platform banners</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Multiple banners can be active. Lower priority number shows first.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-medium text-muted-foreground">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-1"
          >
            {BANNER_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Message"
            className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] sm:col-span-2"
          />
          <div className="flex gap-2 sm:col-span-2">
            <input
              value={gradientFrom}
              onChange={(e) => setGradientFrom(e.target.value)}
              placeholder="#gradient from"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            />
            <input
              value={gradientTo}
              onChange={(e) => setGradientTo(e.target.value)}
              placeholder="#gradient to"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            />
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-[12px]"
              title="Priority"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Publish banner
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void unpublishAll()}
            className="rounded-lg border border-border px-4 py-2 text-[12px]"
          >
            Deactivate all
          </button>
        </div>

        {announcements.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-border pt-4">
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

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-[14px] font-semibold">{group}</h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {items.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="font-medium">{c.name}</span>
                <select
                  value={c.current_status}
                  disabled={busy}
                  onChange={(e) => void updateComponent(c.key, e.target.value as StatusLevel)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[14px] font-semibold">Create incident</h3>
        <div className="mt-3 space-y-2">
          <select
            value={incidentComponent}
            onChange={(e) => setIncidentComponent(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          >
            {components.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={incidentTitle}
            onChange={(e) => setIncidentTitle(e.target.value)}
            placeholder="Incident title"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <textarea
            value={incidentMessage}
            onChange={(e) => setIncidentMessage(e.target.value)}
            placeholder="Incident message"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createIncident()}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Create incident
          </button>
        </div>
      </div>
    </div>
  );
}
