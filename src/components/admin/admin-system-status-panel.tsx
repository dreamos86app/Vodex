"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import type { StatusLevel } from "@/lib/status/status-types";

const TEMPLATES = [
  { id: "builder_degraded", label: "Builder degraded" },
  { id: "platform_issue", label: "Platform issue" },
  { id: "maintenance", label: "Maintenance" },
  { id: "billing_issue", label: "Billing issue" },
  { id: "preview_issue", label: "Preview issue" },
] as const;

const STATUS_OPTIONS: StatusLevel[] = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
];

type CompRow = { key: string; name: string; current_status: StatusLevel };

export function AdminSystemStatusPanel() {
  const [template, setTemplate] = React.useState<string>("platform_issue");
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [components, setComponents] = React.useState<CompRow[]>([]);
  const [incidentTitle, setIncidentTitle] = React.useState("");
  const [incidentMessage, setIncidentMessage] = React.useState("");
  const [incidentComponent, setIncidentComponent] = React.useState("app_builder");

  React.useEffect(() => {
    void fetch("/api/status/public")
      .then((r) => r.json())
      .then((json: { components?: CompRow[] }) => {
        if (json.components) setComponents(json.components);
      })
      .catch(() => {});
  }, []);

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template,
          title: title.trim() || undefined,
          message: message.trim() || undefined,
          linkUrl: "https://status.vodex.dev",
          linkLabel: "Status Page",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      toast.success("Platform banner published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/status/announcements/unpublish", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Unpublish failed");
      toast.success("Banner removed");
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
      toast.success(`${key} → ${currentStatus}`);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div>
          <h3 className="text-[14px] font-semibold">System status &amp; banner</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Public page:{" "}
            <a className="underline" href="/status">
              /status
            </a>{" "}
            ·{" "}
            <a className="underline" href="https://status.vodex.dev" target="_blank" rel="noreferrer">
              status.vodex.dev
            </a>
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-medium text-muted-foreground">Quick template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Custom title (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Custom message (optional)"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish()}
              className="rounded-lg bg-red-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Publish banner
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void unpublish()}
              className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium"
            >
              Unpublish banner
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[14px] font-semibold">Component status</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Updates public status page immediately (30-day history defaults to operational unless set).
        </p>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {components.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-medium text-foreground">{c.name}</span>
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
