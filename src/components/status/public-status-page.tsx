"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { canViewFullStatusPage } from "@/lib/admin-owner";
import type { StatusLevel } from "@/lib/status/status-types";
import { StatusDiscordSubscribeButton } from "@/components/ui/premium-discord-card";

type HistoryDay = { date: string; status: StatusLevel; uptime_percent: number };

type Payload = {
  placeholder?: boolean;
  schemaReady?: boolean;
  viewMode?: "full" | "public";
  overallStatus: StatusLevel;
  components: Array<{
    id: string;
    key: string;
    name: string;
    group_name: string;
    description: string | null;
    current_status: StatusLevel;
    uptimePercent: number;
    history: HistoryDay[];
  }>;
  publicComponents?: Array<{
    key: string;
    name: string;
    group_name: string;
    current_status: StatusLevel;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    message: string;
    status: string;
    severity: string;
    started_at: string;
    resolved_at: string | null;
  }>;
};

const STATUS_COLOR: Record<StatusLevel, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-400",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-500",
  maintenance: "bg-sky-400",
};

const GROUP_ORDER = [
  "Core Platform",
  "Builder",
  "Infrastructure",
  "Billing",
  "Communications",
  "AI Services",
  "Functionalities",
  "Services",
  "Other",
];

const PUBLIC_GROUP_ORDER = ["Functionalities", "Services"];

function StatusSquare({ status, date }: { status: StatusLevel; date: string }) {
  const label = `${date} · ${status.replace(/_/g, " ")}`;
  return (
    <span
      className={cn("inline-block size-2.5 rounded-[3px] ring-1 ring-black/5", STATUS_COLOR[status])}
      title={label}
      aria-label={label}
    />
  );
}

function formatStatusLabel(s: StatusLevel) {
  return s.replace(/_/g, " ");
}

function publicStatusLabel(s: StatusLevel): string {
  if (s === "operational") return "Operational";
  if (s === "maintenance") return "Maintenance";
  return "Affected";
}

function PublicStatusIcon({ status }: { status: StatusLevel }) {
  if (status === "operational") {
    return <CheckCircle2 className="size-4 text-emerald-600" strokeWidth={2} />;
  }
  if (status === "maintenance") {
    return <Wrench className="size-4 text-amber-600" strokeWidth={2} />;
  }
  return <AlertTriangle className="size-4 text-red-600" strokeWidth={2} />;
}

export function PublicStatusPage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const ownerFull = canViewFullStatusPage(user?.email ?? profile?.email);

  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/status/public", { credentials: "include" })
      .then(async (r) => {
        const json = (await r.json()) as Payload & { error?: string };
        if (!r.ok && !json.components?.length && !json.publicComponents?.length) {
          throw new Error(json.error ?? "Failed to load status");
        }
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const fullView = ownerFull || data?.viewMode === "full";

  const operational =
    data?.overallStatus === "operational" &&
    (data?.incidents.filter((i) => !i.resolved_at).length ?? 0) === 0;

  const groups = React.useMemo(() => {
    if (!data || !fullView) return [];
    const map = new Map<string, Payload["components"]>();
    for (const c of data.components) {
      const g = c.group_name || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    const ordered: Array<[string, Payload["components"]]> = [];
    for (const name of GROUP_ORDER) {
      if (map.has(name)) {
        ordered.push([name, map.get(name)!]);
        map.delete(name);
      }
    }
    for (const [name, items] of map) ordered.push([name, items]);
    return ordered;
  }, [data, fullView]);

  const publicGroups = React.useMemo(() => {
    if (!data?.publicComponents?.length) return [];
    const map = new Map<string, NonNullable<Payload["publicComponents"]>>();
    for (const c of data.publicComponents) {
      const g = c.group_name || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return PUBLIC_GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [data]);

  const historyLabels = data?.components[0]?.history;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50/40 text-foreground">
      <header className="border-b border-sky-200/50 bg-white/70 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <Link href="https://vodex.dev" className="text-[15px] font-bold tracking-tight text-sky-900">
            Vodex <span className="font-normal text-sky-600/80">| Status</span>
          </Link>
          <StatusDiscordSubscribeButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {error && <p className="text-destructive">{error}</p>}
        {!data && !error && <p className="text-muted-foreground">Loading status…</p>}

        {data && (
          <>
            {data.placeholder ? (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                Live status data is syncing. Showing operational defaults until database tables
                are installed.
              </p>
            ) : null}

            {fullView && ownerFull ? (
              <p className="mb-4 text-[11px] text-muted-foreground">
                Owner view — full component history and admin groups.
              </p>
            ) : null}

            <div
              className={cn(
                "rounded-2xl border px-6 py-8 text-center shadow-sm backdrop-blur-sm",
                operational
                  ? "border-emerald-200 bg-emerald-50"
                  : data.overallStatus === "degraded" || data.overallStatus === "maintenance"
                    ? "border-amber-200 bg-amber-50"
                    : "border-rose-200 bg-rose-50",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-semibold",
                  operational
                    ? "text-emerald-800"
                    : data.overallStatus === "degraded" || data.overallStatus === "maintenance"
                      ? "text-amber-900"
                      : "text-rose-800",
                )}
              >
                {operational
                  ? "Everything is operational"
                  : data.overallStatus === "degraded"
                    ? "Some systems are degraded"
                    : "Something's not quite right"}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {fullView ? "Last 30 days" : "Current service health"} · updated{" "}
                {new Date().toLocaleString()}
              </p>
            </div>

            {!fullView && publicGroups.length > 0 ? (
              <div className="mt-8 rounded-2xl border border-sky-100/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" /> Operational
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-red-600" /> Affected
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-amber-600" /> Maintenance
                  </span>
                </div>
                {publicGroups.map(([group, items]) => (
                  <section key={group} className="mb-6 last:mb-0">
                    <h2 className="text-[13px] font-semibold text-foreground">{group}</h2>
                    <ul className="mt-2 divide-y divide-sky-100/80 rounded-xl border border-sky-100/60 bg-sky-50/30">
                      {items.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
                        >
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <PublicStatusIcon status={c.current_status} />
                            {c.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 font-medium",
                              c.current_status === "operational"
                                ? "text-emerald-700"
                                : c.current_status === "maintenance"
                                  ? "text-amber-700"
                                  : "text-red-700",
                            )}
                          >
                            {publicStatusLabel(c.current_status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}

            {fullView && historyLabels ? (
              <p className="mt-6 flex justify-between text-[10px] text-muted-foreground">
                <span>30 days ago</span>
                <span>Today</span>
              </p>
            ) : null}

            {fullView
              ? groups.map(([group, items]) => (
                  <section key={group} className="mt-10">
                    <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </h2>
                    <div className="mt-3 space-y-3">
                      {items.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-sky-100/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold">{c.name}</p>
                              {c.description ? (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {c.description}
                                </p>
                              ) : null}
                              <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                                {formatStatusLabel(c.current_status)} · {c.uptimePercent}% uptime
                              </p>
                            </div>
                            <div className="shrink-0">
                              <div className="flex gap-0.5">
                                {c.history.map((d) => (
                                  <StatusSquare key={d.date} status={d.status} date={d.date} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              : null}

            {fullView ? (
              <section className="mt-12">
                <h2 className="text-[14px] font-semibold">Incidents</h2>
                {data.incidents.length === 0 ? (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    No incidents in the last 90 days.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.incidents.map((inc) => (
                      <li key={inc.id} className="rounded-xl border border-border bg-white p-4">
                        <p className="font-semibold">{inc.title}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {inc.status} · {new Date(inc.started_at).toLocaleString()}
                          {inc.resolved_at
                            ? ` · resolved ${new Date(inc.resolved_at).toLocaleString()}`
                            : ""}
                        </p>
                        <p className="mt-2 text-[13px]">{inc.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section className="mt-12 flex justify-center">
              <StatusDiscordSubscribeButton />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
