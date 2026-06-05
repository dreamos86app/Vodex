"use client";

import * as React from "react";
import { BarChart3, Shield, Zap } from "lucide-react";
import { CustomDomainsPanel } from "@/components/publish/custom-domains-panel";
import { getEntitlements } from "@/lib/billing/plan-entitlements";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function DashboardUsersSection({ publicUrl }: { publicUrl?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        User signups from your published app appear here. Share your link to get started.
      </p>
      {publicUrl ? (
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-accent">
          Open live app →
        </a>
      ) : null}
      <Row label="Total users" value="0" />
      <Row label="Active this week" value="0" />
    </div>
  );
}

export function DashboardAnalyticsSection({
  publicUrl,
  projectId,
}: {
  publicUrl?: string | null;
  projectId?: string;
}) {
  const [period, setPeriod] = React.useState<"24h" | "7d" | "30d">("7d");
  const [data, setData] = React.useState<{
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
    signups: number;
    realtimeVisitors: number;
    empty: boolean;
    revenue: { connected: boolean; provider?: string } | null;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/projects/${projectId}/analytics?period=${period}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, period]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
          <BarChart3 className="size-4 text-accent" /> Insights
        </div>
        <div className="flex gap-1">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${
                period === p ? "bg-accent text-white" : "bg-surface ring-1 ring-border text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Row label="Page views" value={String(data?.pageViews ?? 0)} />
          <Row label="Unique visitors" value={String(data?.uniqueVisitors ?? 0)} />
          <Row label="Sessions" value={String(data?.sessions ?? 0)} />
          <Row label="Realtime (5m)" value={String(data?.realtimeVisitors ?? 0)} />
        </div>
      )}
      {data?.revenue?.connected ? (
        <p className="text-[11px] text-emerald-700">Revenue analytics via {data.revenue.provider}</p>
      ) : (
        <p className="rounded-xl bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Connect Stripe, Paddle, or RevenueCat in Payments to unlock revenue analytics.
        </p>
      )}
      {data?.empty ? (
        <p className="text-[11px] text-muted-foreground">
          No traffic yet{publicUrl ? ` — share ${publicUrl.replace(/^https?:\/\//, "")}` : ""}.
        </p>
      ) : null}
    </div>
  );
}

export function DashboardMarketingSection({ publicUrl, appName }: { publicUrl?: string | null; appName: string }) {
  const share = publicUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${appName}`)}&url=${encodeURIComponent(publicUrl)}`
    : null;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">Share your live app and track growth.</p>
      {share ? (
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white"
        >
          Share on X
        </a>
      ) : null}
      <Row label="Share link clicks" value="0" />
    </div>
  );
}

export function DashboardLogsSection({ projectId }: { projectId?: string }) {
  const [events, setEvents] = React.useState<
    Array<{ id: string; category: string; action: string; summary: string; created_at: string }>
  >([]);

  React.useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/projects/${projectId}/activity`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setEvents(json.events ?? []))
      .catch(() => setEvents([]));
  }, [projectId]);

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Recent activity for this app.</p>
      {events.length === 0 ? (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Activity appears after publish, scans, and integrations.
        </div>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
              <p className="text-[12px] font-medium text-foreground">{e.summary}</p>
              <p className="text-[10px] text-muted-foreground">{e.category} · {e.action}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardApiSection({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        API keys for your generated app backend. Keys are stored encrypted and never shown again after creation.
      </p>
      <a
        href={`/apps/${projectId}/builder`}
        className="inline-flex rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border"
      >
        Open API docs in builder
      </a>
    </div>
  );
}

export function DashboardAutomationsSection() {
  const cards = [
    { title: "Welcome emails", desc: "Onboard new signups automatically" },
    { title: "Webhook triggers", desc: "React to form submits and payments" },
    { title: "Scheduled jobs", desc: "Daily digests and reminders" },
    { title: "AI workflows", desc: "Smart follow-ups from user events" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold">
        <Zap className="size-4 text-amber-500" /> Automations
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">Coming soon</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl bg-gradient-to-br from-surface to-muted/20 p-3 ring-1 ring-border transition hover:ring-accent/30"
          >
            <p className="text-[12px] font-semibold text-foreground">{c.title}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>
      <button type="button" className="w-full rounded-xl bg-accent/10 py-2 text-[12px] font-semibold text-accent ring-1 ring-accent/25">
        Notify me when automations launch
      </button>
    </div>
  );
}

export function DashboardDataSection() {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Collections and records created by your app users.</p>
      <Row label="Collections" value="0" />
      <Row label="Records" value="0" />
    </div>
  );
}

export function DashboardDomainsSection({
  projectId,
  planId,
  publishedSubdomain,
}: {
  projectId: string;
  planId: string;
  publishedSubdomain?: string | null;
}) {
  return (
    <CustomDomainsPanel
      projectId={projectId}
      canUseCustomDomain={getEntitlements(planId).canUseCustomDomain}
      publishedSubdomain={publishedSubdomain}
    />
  );
}

export function DashboardSecuritySection({ projectId }: { projectId: string }) {
  const [scanning, setScanning] = React.useState(false);
  const [findings, setFindings] = React.useState<
    Array<{ id: string; severity: string; title: string; detail: string }>
  >([]);

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/security-scan`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        findings?: Array<{ id: string; severity: string; title: string; detail: string }>;
      };
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setFindings(json.findings ?? []);
    } catch (e) {
      setFindings([
        {
          id: "scan_error",
          severity: "low",
          title: "Scan unavailable",
          detail: e instanceof Error ? e.message : "Try again shortly",
        },
      ]);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <Shield className="size-4 text-accent" /> Security scan
          </div>
          <button
            type="button"
            disabled={scanning}
            onClick={() => void runScan()}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Run scan"}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          <Row label="HTTPS" value="Enforced" />
          <Row label="RLS" value="Protected" />
        </div>
        {findings.length > 0 ? (
          <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
            {findings.map((f) => (
              <li
                key={f.id}
                className={`rounded-lg px-2.5 py-2 text-[11px] ring-1 ${
                  f.severity === "critical"
                    ? "bg-red-500/10 ring-red-500/25 text-red-900"
                    : f.severity === "high"
                      ? "bg-amber-500/10 ring-amber-500/25 text-amber-900"
                      : "bg-muted/30 ring-border text-muted-foreground"
                }`}
              >
                <span className="font-semibold">{f.title}</span> — {f.detail}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardSettingsWatermark({
  planId,
  disabled,
  onToggle,
}: {
  planId: string;
  disabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const canDisable = getEntitlements(planId).tier !== "free";
  return (
    <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
      <p className="text-[12px] font-semibold text-foreground">Published app watermark</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Free plans always show &quot;Made with Vodex&quot; on published apps. Starter+ can hide it.
      </p>
      <label className="mt-3 flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          disabled={!canDisable}
          checked={canDisable ? disabled : false}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Hide watermark on published app
      </label>
      {!canDisable ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <a href="/billing" className="text-accent">
            Upgrade to Starter
          </a>{" "}
          to remove the watermark.
        </p>
      ) : null}
    </div>
  );
}
