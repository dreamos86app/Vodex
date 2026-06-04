"use client";

import * as React from "react";
import { Loader2, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatHeartbeatAge,
  type PreviewWorkerStatusPayload,
} from "@/lib/preview/preview-worker-labels";

export function AdminPreviewRuntimePanel() {
  const [status, setStatus] = React.useState<PreviewWorkerStatusPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/preview-worker/status", { cache: "no-store" });
      const j = (await res.json()) as PreviewWorkerStatusPayload & { error?: string };
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setStatus(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load worker status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const connected = status?.connected === true;
  const primaryWorker = status?.workers[0];

  return (
    <div className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-border" data-testid="preview-runtime-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Preview Runtime</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Dedicated worker for ZIP npm install/build (required on Vercel production).
          </p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-[12px] text-destructive">{error}</p>
      ) : loading && !status ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading worker status…
        </div>
      ) : status ? (
        <>
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              connected ? "border-positive/30 bg-positive/8" : "border-destructive/30 bg-destructive/8",
            )}
          >
            <Server className={cn("mt-0.5 size-4 shrink-0", connected ? "text-positive" : "text-destructive")} />
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {connected ? "● Connected" : "⚠ Preview Worker Not Connected"}
              </p>
              {connected && primaryWorker ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Worker: <span className="font-mono text-foreground">{primaryWorker.workerId}</span>
                  <br />
                  Last heartbeat: {formatHeartbeatAge(primaryWorker.ageSeconds)}
                </p>
              ) : (
                <p className="mt-1 text-[12px] text-destructive">
                  ZIP builds cannot run. Deploy or reconnect the worker before importing ZIP projects.
                </p>
              )}
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[12px]">
            <Stat label="Pending" value={String(status.pendingJobs)} />
            <Stat label="Running" value={String(status.runningJobs)} />
            <Stat label="Completed today" value={String(status.completedJobs24h)} />
            <Stat label="Failed today" value={String(status.failedJobs24h)} />
            <Stat label="Queue age" value={status.queueAgeSeconds > 0 ? `${status.queueAgeSeconds}s` : "—"} />
            <Stat label="Workers online" value={String(status.workerCount)} />
          </dl>

          {status.workers.length > 1 ? (
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {status.workers.map((w) => (
                <li key={w.workerId} className="font-mono">
                  {w.workerId} · {formatHeartbeatAge(w.ageSeconds)}
                  {w.host ? ` · ${w.host}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
