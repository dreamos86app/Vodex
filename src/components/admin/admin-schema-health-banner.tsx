"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import Link from "next/link";

type SchemaHealthPayload = {
  ok: boolean;
  missing: Array<{
    table?: string;
    column?: string;
    rpc?: string;
    type: "table" | "column" | "rpc";
    hint?: string;
  }>;
  projectRef: string | null;
  checkedAt: string;
  migrationHint?: string;
  tablesChecked?: number;
  chargeTokensRpc?: boolean;
};

const CACHE_KEY = "dreamos-admin-schema-health";
const CACHE_MS = 45_000;

export function AdminSchemaHealthBanner() {
  const [data, setData] = React.useState<SchemaHealthPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback((refresh = false) => {
    if (!refresh && typeof sessionStorage !== "undefined") {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { at: number; payload: SchemaHealthPayload };
          if (Date.now() - cached.at < CACHE_MS) {
            setData(cached.payload);
            setLoading(false);
            return Promise.resolve();
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    const q = refresh ? `?refresh=1&t=${Date.now()}` : "";
    return fetch(`/api/admin/schema-health${q}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((json: SchemaHealthPayload) => {
        setData(json);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), payload: json }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => setData(null))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="h-12 animate-pulse rounded-xl bg-surface ring-1 ring-border" aria-hidden />
    );
  }

  if (!data) return null;

  if (data.ok) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[12px]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Database schema OK</p>
          <p className="text-muted-foreground">
            {data.projectRef ? `Project ${data.projectRef}` : "Supabase"}
            {data.tablesChecked ? ` · ${data.tablesChecked} tables checked` : ""}
            {data.chargeTokensRpc ? " · charge_tokens OK" : ""} —{" "}
            {new Date(data.checkedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground ring-1 ring-border hover:bg-background"
          title="Re-check schema"
        >
          <RefreshCw className={cnRefresh(refreshing)} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Database schema incomplete</p>
        <p className="mt-1 text-muted-foreground">
          Admin tabs may show empty data until migrations are applied
          {data.projectRef ? ` (${data.projectRef})` : ""}.
          Run the SQL below, then click Refresh.
        </p>
        <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-muted-foreground">
          {data.missing.map((m) => (
            <li key={`${m.type}-${m.table ?? m.rpc}-${m.column ?? ""}`} className="text-[11px]">
              {m.type === "rpc"
                ? `RPC missing: ${m.rpc}`
                : m.type === "table"
                  ? `Table missing: ${m.table}`
                  : `${m.table}.${m.column}`}
              {m.hint ? (
                <span className="mt-0.5 block font-mono text-[10px] opacity-80">{m.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {data.migrationHint && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">{data.migrationHint}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-lg bg-background px-2.5 py-1 text-[11px] font-medium text-foreground ring-1 ring-border"
          >
            <RefreshCw className={cnRefresh(refreshing)} />
            Refresh check
          </button>
          <Link
            href={`/api/admin/schema-health?refresh=1&t=${Date.now()}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            <Database className="size-3" />
            Full JSON
          </Link>
        </div>
      </div>
    </div>
  );
}

function cnRefresh(refreshing: boolean) {
  return `size-3.5 ${refreshing ? "animate-spin" : ""}`;
}
