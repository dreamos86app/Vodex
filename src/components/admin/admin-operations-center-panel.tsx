"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

type OpsSnapshot = {
  previewWorker?: { connected: boolean; lastSeen?: string | null };
  mobileBuilds?: { queued: number; success: number; failed: number };
  notifications?: { recentBroadcasts: number };
  publishing?: { publishedApps: number };
  zipJobs?: { queued: number; succeeded: number; failed: number };
  billing?: { paddleWebhooks7d: number };
  storage?: { errors7d: number };
  status?: { degradedComponents: number; totalComponents: number };
  diagnostics?: { failedPreviewBuilds7d: number };
  fetchedAt: string;
};

export function AdminOperationsCenterPanel() {
  const [data, setData] = React.useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/operations-snapshot", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as OpsSnapshot & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4" data-testid="admin-operations-center">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold">Operations Center</h2>
          <p className="text-[12px] text-muted-foreground">
            Worker, queues, mobile builds, publishing, ZIP previews, notifications — live snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px]"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Refresh
        </button>
      </div>

      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Preview worker"
            value={data.previewWorker?.connected ? "Connected" : "Offline"}
            sub={data.previewWorker?.lastSeen ? `Last seen ${new Date(data.previewWorker.lastSeen).toLocaleString()}` : "—"}
            ok={data.previewWorker?.connected}
          />
          <MetricCard
            title="ZIP preview jobs"
            value={`${data.zipJobs?.succeeded ?? 0} ok / ${data.zipJobs?.queued ?? 0} queued`}
            sub={`${data.zipJobs?.failed ?? 0} failed`}
            ok={(data.zipJobs?.failed ?? 0) === 0}
          />
          <MetricCard
            title="Mobile builds"
            value={`${data.mobileBuilds?.success ?? 0} verified`}
            sub={`${data.mobileBuilds?.queued ?? 0} queued · ${data.mobileBuilds?.failed ?? 0} failed`}
            ok={(data.mobileBuilds?.failed ?? 0) === 0}
          />
          <MetricCard
            title="Published apps"
            value={String(data.publishing?.publishedApps ?? 0)}
            sub="Live published_apps rows"
            ok
          />
          <MetricCard
            title="Notifications"
            value={String(data.notifications?.recentBroadcasts ?? 0)}
            sub="Recent admin broadcasts (7d)"
            ok
          />
          <MetricCard
            title="Billing (Paddle)"
            value={String(data.billing?.paddleWebhooks7d ?? 0)}
            sub="Webhook events (7d)"
            ok
          />
          <MetricCard
            title="Storage errors"
            value={String(data.storage?.errors7d ?? 0)}
            sub="analytics_events storage_error (7d)"
            ok={(data.storage?.errors7d ?? 0) === 0}
          />
          <MetricCard
            title="Platform status"
            value={
              (data.status?.degradedComponents ?? 0) === 0
                ? "All operational"
                : `${data.status?.degradedComponents} degraded`
            }
            sub={`${data.status?.totalComponents ?? 0} components tracked`}
            ok={(data.status?.degradedComponents ?? 0) === 0}
          />
          <MetricCard
            title="Failed previews"
            value={String(data.diagnostics?.failedPreviewBuilds7d ?? 0)}
            sub="preview_build_jobs failed (7d)"
            ok={(data.diagnostics?.failedPreviewBuilds7d ?? 0) === 0}
          />
          <MetricCard
            title="Snapshot"
            value="Live"
            sub={new Date(data.fetchedAt).toLocaleString()}
            ok
          />
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  ok,
}: {
  title: string;
  value: string;
  sub: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl bg-background/80 p-3 ring-1 ring-border/70">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={`mt-1 text-[15px] font-bold ${ok === false ? "text-destructive" : "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
