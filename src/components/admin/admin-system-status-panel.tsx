"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
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

export function AdminSystemStatusPanel() {
  const [schemaReady, setSchemaReady] = React.useState<boolean | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [components, setComponents] = React.useState<CompRow[]>([]);
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
