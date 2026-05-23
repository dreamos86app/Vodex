"use client";

import * as React from "react";
import { X, Copy, Trash2, Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearClientDiagnosticLogs,
  readClientDiagnosticLogs,
  type DreamosLogRow,
} from "@/lib/diagnostics/dreamos-logger";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { scanDomWiringIssues } from "@/components/dev/diagnostics-bootstrap";
import {
  markClientFetchError,
  markClientFetchSuccess,
  shouldThrottleClientFetch,
} from "@/lib/network/client-fetch-backoff";

type TabId =
  | "overview"
  | "network"
  | "supabase"
  | "credit"
  | "providers"
  | "api"
  | "build"
  | "ui"
  | "missing"
  | "live"
  | "publish";

type DiagnosticsPayload = {
  logging?: { tableOk: boolean; tableError?: string | null; hint?: string | null };
  liveEvents?: unknown[];
  missingIds?: unknown[];
  apiErrors?: unknown[];
  supabaseHealth?: { ok?: boolean; missing?: unknown[] };
  creditBilling?: { chargeProbe?: { ok?: boolean; lastError?: string | null }; providerBlocked?: unknown[] };
  buildPipeline?: { jobs?: unknown[]; logs?: unknown[] };
  uiActions?: unknown[];
  publishReadiness?: unknown[];
  adminActions?: { pending?: unknown[]; logs?: unknown[] };
  domWiring?: unknown[];
  frontendErrors?: unknown[];
  runtimeHealth?: import("@/lib/db/admin-runtime-health").AdminRuntimeHealth;
  networkSsl?: {
    last?: {
      at: string;
      context: string;
      hostname: string;
      pathname: string;
      errorCode: string | null;
      message: string;
      hostBucket: string;
      suggestedFix: string;
    } | null;
    supabaseEnv?: { ok?: boolean; hostname?: string | null; warnings?: string[]; errors?: string[] };
  };
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "supabase", label: "Schema" },
  { id: "credit", label: "Credits" },
  { id: "providers", label: "AI Providers" },
  { id: "api", label: "Chat/Preflight" },
  { id: "build", label: "Build" },
  { id: "network", label: "Network/SSL" },
  { id: "ui", label: "UI Actions" },
  { id: "missing", label: "Missing IDs" },
  { id: "live", label: "Raw Logs" },
  { id: "publish", label: "Publish" },
];

function LogRows({ rows, empty }: { rows: unknown[]; empty: string }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-[11px] text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((raw, i) => {
        const e = raw as Record<string, unknown>;
        const at = String(e.at ?? e.created_at ?? "—");
        const msg = String(e.message ?? e.error_message ?? JSON.stringify(e).slice(0, 120));
        return (
          <div key={i} className="rounded-lg bg-surface/80 px-2.5 py-2 ring-1 ring-border/60">
            <p className="font-medium text-foreground">{msg}</p>
            <p className="text-[10px] text-muted-foreground">{at}</p>
            {e.metadata || e.action ? (
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-foreground/70">
                {JSON.stringify({ action: e.action, category: e.category, metadata: e.metadata }, null, 0)}
              </pre>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProviderHealthTab() {
  const [rows, setRows] = React.useState<
    Array<{ provider: string; status: string; configured: boolean; warnings: string[] }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/admin/provider-health", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { providers?: typeof rows } | null) => setRows(j?.providers ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-4 text-center text-muted-foreground">Loading provider health…</p>;
  if (!rows.length) return <p className="py-4 text-center text-muted-foreground">No provider data.</p>;

  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.provider} className="rounded-lg bg-surface/80 px-2.5 py-2 ring-1 ring-border/60">
          <p className="font-medium capitalize text-foreground">
            {p.provider} · {p.status} · {p.configured ? "configured" : "no key"}
          </p>
          {p.warnings.map((w) => (
            <p key={w} className="text-[10px] text-amber-600">
              {w}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function mergeClientLive(server: unknown[], client: DreamosLogRow[]): unknown[] {
  const clientRows = client.map((c) => ({
    at: c.at,
    message: c.message,
    category: c.category,
    action: c.action,
    severity: c.severity,
    metadata: c.metadata,
  }));
  return [...clientRows, ...server].slice(0, 120);
}

export function AdminDiagnosticsDrawer() {
  const email = useAuthStore((s) => s.profile?.email);
  const isOwner = isDreamosOwnerEmail(email);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabId>("overview");
  const [data, setData] = React.useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [clientLogs, setClientLogs] = React.useState<DreamosLogRow[]>([]);

  const refresh = React.useCallback(async () => {
    const key = "admin_diagnostics";
    if (shouldThrottleClientFetch(key)) return;
    setClientLogs(readClientDiagnosticLogs());
    setLoading(true);
    try {
      const r = await fetch("/api/admin/diagnostics", { credentials: "include", cache: "no-store" });
      if (r.ok) {
        setData((await r.json()) as DiagnosticsPayload);
        markClientFetchSuccess(key);
      } else {
        markClientFetchError(key);
      }
    } catch {
      markClientFetchError(key);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isOwner || !open) return;
    void refresh();
    const t = setInterval(() => {
      setClientLogs(readClientDiagnosticLogs());
    }, 5000);
    return () => clearInterval(t);
  }, [isOwner, open, refresh]);

  if (!isOwner) return null;

  const live = mergeClientLive(data?.liveEvents ?? [], clientLogs);
  const domScan = scanDomWiringIssues();

  const rh = data?.runtimeHealth;
  const infraBlockers =
    (rh?.ok ? 0 : 1) + (rh?.rpcs.charge_tokens.callableByPostgrest ? 0 : 1);
  const blockers = infraBlockers;
  const recentApiErrors = (data?.apiErrors as unknown[])?.length ?? 0;

  let panel: React.ReactNode = null;
  switch (tab) {
    case "overview":
      panel = (
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface px-2.5 py-2 ring-1 ring-border">
              <p className="text-[10px] text-muted-foreground">Critical blockers</p>
              <p className={cn("text-lg font-semibold", blockers ? "text-destructive" : "text-positive")}>
                {blockers}
              </p>
            </div>
            <div className="rounded-lg bg-surface px-2.5 py-2 ring-1 ring-border">
              <p className="text-[10px] text-muted-foreground">Live events</p>
              <p className="text-lg font-semibold text-foreground">{live.length}</p>
            </div>
          </div>
          <ul className="space-y-1 text-foreground/90">
            <li>
              Schema:{" "}
              <span className={rh?.ok ? "text-positive" : "text-destructive"}>
                {rh?.ok ? "OK" : `${rh?.missing.length ?? "?"} issues`}
              </span>
            </li>
            <li>
              charge_tokens:{" "}
              <span className={rh?.rpcs.charge_tokens.callableByPostgrest ? "text-positive" : "text-destructive"}>
                {rh?.rpcs.charge_tokens.callableByPostgrest ? "PostgREST callable" : "PostgREST blocked"}
              </span>
            </li>
            <li>
              Helper RPC:{" "}
              <span className={rh?.helperRpcUnavailable ? "text-amber-600" : "text-positive"}>
                {rh?.helperRpcUnavailable ? "debug helper unavailable" : "available"}
              </span>
            </li>
            <li>API errors (recent): {recentApiErrors}</li>
            <li>Build jobs: {(data?.buildPipeline?.jobs as unknown[])?.length ?? 0}</li>
            <li>Missing ID events: {(data?.missingIds as unknown[])?.length ?? 0}</li>
            <li>DOM wiring issues: {domScan.length}</li>
            <li>
              SSL fetch errors:{" "}
              <span className={data?.networkSsl?.last ? "text-destructive" : "text-positive"}>
                {data?.networkSsl?.last ? "yes (see Network tab)" : "none"}
              </span>
            </li>
          </ul>
          <p className="text-[10px] text-muted-foreground">
            Use Schema, Credits, and Chat/API tabs for detail. Missing IDs is only one category — not overall health.
          </p>
        </div>
      );
      break;
    case "network": {
      const ssl = data?.networkSsl?.last;
      const env = data?.networkSsl?.supabaseEnv;
      panel = (
        <div className="space-y-3 text-[11px]">
          {ssl ? (
            <div className="rounded-lg bg-destructive/5 px-3 py-2 ring-1 ring-destructive/20">
              <p className="font-semibold text-destructive">Last SSL / fetch failure</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{ssl.at}</p>
              <ul className="mt-2 space-y-0.5 font-mono text-[10px]">
                <li>context: {ssl.context}</li>
                <li>hostname: {ssl.hostname}</li>
                <li>pathname: {ssl.pathname}</li>
                <li>code: {ssl.errorCode ?? "—"}</li>
                <li>bucket: {ssl.hostBucket}</li>
              </ul>
              <p className="mt-2 text-foreground/90">{ssl.message}</p>
              <p className="mt-2 text-amber-700 dark:text-amber-300">{ssl.suggestedFix}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No SSL fetch errors recorded on this server process yet.</p>
          )}
          {env ? (
            <div className="rounded-lg bg-surface px-3 py-2 ring-1 ring-border">
              <p className="font-semibold">Supabase env</p>
              <p>
                hostname: <span className="font-mono">{env.hostname ?? "—"}</span> · ok={String(env.ok)}
              </p>
              {(env.errors ?? []).map((e) => (
                <p key={e} className="text-destructive">
                  {e}
                </p>
              ))}
              {(env.warnings ?? []).map((w) => (
                <p key={w} className="text-amber-600">
                  {w}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      );
      break;
    }
    case "live":
      panel = (
        <>
          {!data?.logging?.tableOk && (
            <p className="mb-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300">
              {data?.logging?.hint ?? "dreamos_diagnostic_logs table missing — run SQL migration."}
            </p>
          )}
          <LogRows rows={live} empty="No events captured yet. Use the app or trigger admin/build flows." />
        </>
      );
      break;
    case "missing":
      panel = (
        <LogRows
          rows={[...(data?.missingIds ?? []), ...clientLogs.filter((l) => l.category === "missing_id")]}
          empty="No missing ID events logged."
        />
      );
      break;
    case "api":
      panel = (
        <LogRows
          rows={[
            ...(data?.apiErrors ?? []),
            ...(data?.frontendErrors ?? []),
            ...clientLogs.filter((l) => l.category === "api_error" || l.category === "frontend_error"),
          ]}
          empty="No API or frontend errors logged."
        />
      );
      break;
    case "supabase":
      panel = (
        <div className="space-y-2 text-[11px]">
          <p className={cn("font-semibold", rh?.ok ? "text-positive" : "text-destructive")}>
            Schema {rh?.ok ? "OK" : "issues"} · source={rh?.source ?? "—"}
          </p>
          <LogRows
            rows={(rh?.missing ?? []).map((m) => ({
              message: `${m.type} ${m.name}: ${m.reason}`,
              metadata: { fix: m.fix },
            }))}
            empty="No schema gaps reported."
          />
          <pre className="max-h-48 overflow-auto rounded-lg bg-surface p-2 text-[10px]">
            {JSON.stringify(rh?.tables ?? {}, null, 2)}
          </pre>
        </div>
      );
      break;
    case "providers":
      panel = (
        <ProviderHealthTab />
      );
      break;
    case "credit":
      panel = (
        <div className="space-y-2">
          <p className="text-[11px]">
            charge_tokens pg: {rh?.rpcs.charge_tokens.existsInPostgres ? "yes" : "no"} · postgrest:{" "}
            {rh?.rpcs.charge_tokens.callableByPostgrest ? "yes" : "no"} · service:{" "}
            {rh?.rpcs.charge_tokens.executableByServiceRole ? "yes" : "no"}
          </p>
          {rh?.rpcs.charge_tokens.lastError ? (
            <p className="text-[10px] text-destructive">{rh.rpcs.charge_tokens.lastError}</p>
          ) : null}
          <LogRows
            rows={[
              ...((data?.creditBilling?.providerBlocked as unknown[]) ?? []),
              ...clientLogs.filter((l) => l.category === "credit" || l.category === "provider_blocked"),
            ]}
            empty="No credit/billing events."
          />
        </div>
      );
      break;
    case "build":
      panel = (
        <>
          <p className="mb-2 text-[10px] text-muted-foreground">
            Recent jobs: {(data?.buildPipeline?.jobs as unknown[])?.length ?? 0}
          </p>
          <LogRows
            rows={[
              ...((data?.buildPipeline?.jobs as unknown[]) ?? []).map((j) => {
                const row = j as Record<string, unknown>;
                return {
                  at: row.created_at,
                  message: `build_job ${row.status}`,
                  metadata: row,
                };
              }),
              ...((data?.buildPipeline?.logs as unknown[]) ?? []),
            ]}
            empty="No build pipeline activity."
          />
        </>
      );
      break;
    case "ui":
      panel = (
        <>
          <p className="mb-2 text-[10px] font-medium text-muted-foreground">DOM wiring scan ({domScan.length})</p>
          <LogRows rows={domScan.map((d) => ({ message: d.message, metadata: d.metadata }))} empty="No DOM wiring issues detected on this page." />
          <LogRows
            rows={[...(data?.uiActions ?? []), ...clientLogs.filter((l) => l.category === "ui_action")]}
            empty="No UI action traces yet."
          />
        </>
      );
      break;
    case "publish":
      panel = (
        <LogRows rows={data?.publishReadiness ?? []} empty="No publish readiness gaps on recent projects." />
      );
      break;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        className="fixed bottom-20 right-3 z-[90] flex size-10 items-center justify-center rounded-full bg-amber-500/90 text-amber-950 shadow-lg ring-2 ring-amber-300/50 lg:bottom-6"
        title="Admin diagnostics"
        aria-label="Open admin diagnostics"
      >
        <Activity className="size-4" strokeWidth={2} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold">Admin diagnostics</p>
                <p className="text-[11px] text-muted-foreground">Owner only · missing wiring & runtime health</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-surface">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium",
                    tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 border-b border-border px-4 py-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] ring-1 ring-border"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    JSON.stringify({ client: clientLogs, server: data, domScan }, null, 2),
                  );
                }}
                className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] ring-1 ring-border"
              >
                <Copy className="size-3.5" />
                Copy bundle
              </button>
              <button
                type="button"
                onClick={() => {
                  clearClientDiagnosticLogs();
                  setClientLogs([]);
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-surface"
              >
                <Trash2 className="size-3.5" />
                Clear local
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px]">{panel}</div>

            {data?.adminActions?.pending && (data.adminActions.pending as unknown[]).length > 0 && (
              <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                Pending admin confirmations: {(data.adminActions.pending as unknown[]).length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
