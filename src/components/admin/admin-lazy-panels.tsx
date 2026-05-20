"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function AdminStoragePanel() {
  const [events, setEvents] = React.useState<
    Array<{ id: string; created_at: string; user_id: string; properties: Record<string, unknown> }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/storage-errors?limit=50")
      .then(async (res) => {
        const json = (await res.json()) as { events?: typeof events; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Failed to load upload errors");
          setEvents([]);
        } else {
          setEvents(json.events ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error loading upload errors");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PanelSkeleton />;

  if (error) {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">No upload errors recorded</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <pre key={ev.id} className="overflow-auto rounded-lg bg-surface p-3 text-[11px] ring-1 ring-border">
          {JSON.stringify(ev.properties, null, 2)}
        </pre>
      ))}
    </div>
  );
}

export function AdminAuditPanel() {
  const [logs, setLogs] = React.useState<
    Array<{
      id: string;
      created_at: string;
      action: string;
      admin_user_id: string;
      target_user_id: string | null;
      before_state: unknown;
      after_state: unknown;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/audit-logs?limit=50")
      .then(async (res) => {
        const json = (await res.json()) as { logs?: typeof logs; error?: string; hint?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError([json.error, json.hint].filter(Boolean).join(" — ") || "Failed to load audit log");
          setLogs([]);
        } else {
          setLogs(json.logs ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error loading audit log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PanelSkeleton />;

  if (error) {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>;
  }

  if (logs.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">No admin audit events yet</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg bg-surface px-4 py-3 ring-1 ring-border">
          <p className="text-[12.5px] font-medium">{log.action}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(log.created_at).toLocaleString()} · target {log.target_user_id?.slice(0, 8) ?? "—"}
          </p>
          {Boolean(log.before_state ?? log.after_state) && (
            <pre className="mt-2 max-h-24 overflow-auto text-[10px] text-muted-foreground">
              {JSON.stringify({ before: log.before_state, after: log.after_state })}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
