"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Copy,
  Check,
  Users,
  Share2,
  Sparkles,
  Globe,
  Monitor,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-gradient-to-br from-surface to-muted/20 p-3 ring-1 ring-border"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-[20px] font-bold tabular-nums text-foreground">{value}</p>
      {delta ? <p className="mt-0.5 text-[10px] text-emerald-600">{delta}</p> : null}
    </motion.div>
  );
}

function MiniBarChart({ data }: { data: Array<{ name: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No data yet</p>
      ) : (
        data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-24 truncate text-[10px] text-muted-foreground">{d.name || "—"}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-accent"
              />
            </div>
            <span className="w-8 text-right text-[10px] font-medium tabular-nums">{d.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

type AnalyticsPayload = {
  period: string;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  signups: number;
  logins?: number;
  authViews?: number;
  activeUsers: number;
  conversionRate: number;
  realtimeVisitors: number;
  topPages: Array<{ name: string; count: number }>;
  referrers: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
  devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  errors: Array<Record<string, unknown>>;
  revenue: { connected: boolean; provider?: string } | null;
  empty: boolean;
  timeseries?: Array<{ date: string; views: number }>;
};

const PERIODS = ["realtime", "24h", "7d", "30d", "90d"] as const;

export function InsightsDashboardPanel({
  projectId,
  publicUrl,
}: {
  projectId: string;
  publicUrl?: string | null;
}) {
  const [period, setPeriod] = React.useState<(typeof PERIODS)[number]>("7d");
  const [data, setData] = React.useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const load = () => {
      setLoading(true);
      void fetch(`/api/projects/${projectId}/analytics?period=${period}`, { credentials: "include" })
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled) setData(json);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    if (period === "realtime") interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [projectId, period]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <BarChart3 className="size-4 text-accent" /> Insights
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[10px] font-medium capitalize",
                period === p ? "bg-accent text-white" : "bg-surface ring-1 ring-border text-muted-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricCard label="Page views" value={data?.pageViews ?? 0} />
            <MetricCard label="Unique visitors" value={data?.uniqueVisitors ?? 0} />
            <MetricCard label="Sessions" value={data?.sessions ?? 0} />
            <MetricCard label="Signups" value={data?.signups ?? 0} />
            <MetricCard label="Logins" value={data?.logins ?? 0} />
            <MetricCard label="Conversion" value={`${data?.conversionRate ?? 0}%`} />
            <MetricCard label="Live now" value={data?.realtimeVisitors ?? 0} />
          </div>

          {data?.revenue?.connected ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 ring-1 ring-emerald-500/20">
              <p className="text-[12px] font-semibold text-emerald-900">{data.revenue.provider} connected</p>
              <p className="mt-1 text-[11px] text-emerald-800/90">
                Provider status is live. MRR, ARR, and paying-user metrics will appear here once provider API sync ships.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-3">
              <p className="text-[12px] font-semibold text-foreground">Revenue analytics locked</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Connect Stripe, Paddle, or RevenueCat in Payments. Vodex does not report revenue until your provider is connected.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <p className="mb-2 text-[11px] font-semibold">Top pages</p>
              <MiniBarChart data={data?.topPages ?? []} />
            </div>
            <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <p className="mb-2 text-[11px] font-semibold">Referrers</p>
              <MiniBarChart data={data?.referrers ?? []} />
            </div>
            <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold">
                <Monitor className="size-3" /> Devices
              </p>
              <MiniBarChart data={data?.devices ?? []} />
            </div>
            <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold">
                <Globe className="size-3" /> Countries
              </p>
              <MiniBarChart data={data?.countries ?? []} />
            </div>
          </div>

          {(data?.errors?.length ?? 0) > 0 ? (
            <div className="rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/20">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
                <AlertTriangle className="size-3.5" /> Recent errors ({data?.errors.length})
              </p>
            </div>
          ) : null}

          {data?.empty ? (
            <p className="text-center text-[11px] text-muted-foreground">
              No traffic yet{publicUrl ? ` — share ${publicUrl.replace(/^https?:\/\//, "")}` : ""}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

const SHARE_CHANNELS = [
  { id: "x", label: "X", build: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { id: "linkedin", label: "LinkedIn", build: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { id: "facebook", label: "Facebook", build: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: "whatsapp", label: "WhatsApp", build: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { id: "telegram", label: "Telegram", build: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { id: "reddit", label: "Reddit", build: (url: string, text: string) => `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
  { id: "email", label: "Email", build: (url: string, text: string) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
] as const;

export function GrowthDashboardPanel({
  projectId,
  publicUrl,
  appName,
}: {
  projectId: string;
  publicUrl?: string | null;
  appName: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [stats, setStats] = React.useState<{ totalClicks: number; byChannel: Array<{ channel: string; count: number }> } | null>(null);

  React.useEffect(() => {
    void fetch(`/api/projects/${projectId}/growth`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, [projectId]);

  async function track(channel: string) {
    await fetch(`/api/projects/${projectId}/growth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ channel, action: "click" }),
    }).catch(() => null);
    setStats((s) =>
      s
        ? {
            ...s,
            totalClicks: s.totalClicks + 1,
            byChannel: [...s.byChannel.filter((c) => c.channel !== channel), { channel, count: (s.byChannel.find((c) => c.channel === channel)?.count ?? 0) + 1 }],
          }
        : s,
    );
  }

  const shareText = `Check out ${appName}`;

  return (
    <div className="space-y-4">
      {publicUrl ? (
        <div className="overflow-hidden rounded-2xl ring-1 ring-border">
          <div className="bg-gradient-to-br from-accent/10 to-indigo-500/10 p-4">
            <p className="text-[13px] font-semibold text-foreground">{appName}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{publicUrl}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {publicUrl
          ? SHARE_CHANNELS.map((ch) => (
              <a
                key={ch.id}
                href={ch.build(publicUrl, shareText)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void track(ch.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[11px] font-medium ring-1 ring-border transition hover:ring-accent/40"
              >
                <Share2 className="size-3 text-accent" />
                {ch.label}
              </a>
            ))
          : null}
        {publicUrl ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              void track("copy");
              toast.success("Link copied");
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-white"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            Copy link
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 ring-1 ring-border">
        <span className="text-[11px] text-muted-foreground">Share clicks</span>
        <span className="text-[13px] font-bold tabular-nums">{stats?.totalClicks ?? 0}</span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-4 ring-1 ring-violet-500/20">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <Sparkles className="size-4 text-violet-600" /> AI Growth Assistant
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-700">Coming soon</span>
        </div>
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <li>• Launch checklist</li>
          <li>• Social copy generator</li>
          <li>• SEO suggestions</li>
        </ul>
      </div>
    </div>
  );
}

export function DataDashboardPanel({ projectId }: { projectId: string }) {
  const [collections, setCollections] = React.useState<
    Array<{ name: string; source: string; fieldCount: number; permissionStatus: string; fields: string[] }>
  >([]);
  const [filter, setFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void fetch(`/api/projects/${projectId}/data`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setCollections(json.collections ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = collections.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search collections…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/30"
      />
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      ) : filtered.length === 0 ? (
        <p className="rounded-xl bg-muted/30 px-3 py-4 text-center text-[12px] text-muted-foreground">
          No data collections detected yet. Import a ZIP or generate a backend schema.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.name} className="rounded-xl bg-surface p-3 ring-1 ring-border">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.source} · {c.fieldCount} fields</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                    c.permissionStatus === "protected"
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.permissionStatus}
                </span>
              </div>
              {c.fields.length > 0 ? (
                <p className="mt-2 truncate text-[10px] text-muted-foreground">{c.fields.join(", ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UsersDashboardPanel({
  projectId,
  publicUrl,
}: {
  projectId: string;
  publicUrl?: string | null;
}) {
  const [data, setData] = React.useState<{
    total: number;
    activeThisWeek: number;
    newSignups: number;
    users: Array<{ id: string; email: string | null; name: string | null; provider: string; createdAt: string; lastSeen: string | null }>;
    authMethods: Array<{ name: string; count: number }>;
    empty: boolean;
  } | null>(null);

  const loadUsers = React.useCallback(() => {
    void fetch(`/api/projects/${projectId}/users`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [projectId]);

  React.useEffect(() => {
    loadUsers();
    const onFocus = () => loadUsers();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadUsers]);

  if (!data) return <div className="h-20 animate-pulse rounded-xl bg-muted/40" />;

  if (data.empty) {
    return (
      <div className="space-y-3 text-center">
        <Users className="mx-auto size-8 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">No users yet. Open your live app to test signup.</p>
        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white">
            Open live app
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Total" value={data.total} />
        <MetricCard label="Active (7d)" value={data.activeThisWeek} />
        <MetricCard label="New signups" value={data.newSignups} />
      </div>
      {data.authMethods.length > 0 ? (
        <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
          <p className="mb-2 text-[11px] font-semibold">Auth methods</p>
          <MiniBarChart data={data.authMethods.map((m) => ({ name: m.name, count: m.count }))} />
        </div>
      ) : null}
      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {data.users.map((u) => (
          <li key={u.id} className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
              {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{u.name ?? u.email ?? "User"}</p>
              <p className="text-[10px] text-muted-foreground">
                {u.provider}
                {u.lastSeen ? ` · active ${new Date(u.lastSeen).toLocaleDateString()}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
