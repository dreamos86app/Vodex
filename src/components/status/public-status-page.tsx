"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StatusLevel } from "@/lib/status/status-types";

type Payload = {
  overallStatus: StatusLevel;
  components: Array<{
    id: string;
    key: string;
    name: string;
    group_name: string;
    current_status: StatusLevel;
    uptimePercent: number;
    history: Array<{ date: string; status: StatusLevel; uptime_percent: number }>;
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

function StatusSquare({ status }: { status: StatusLevel }) {
  return (
    <span
      className={cn("inline-block size-2.5 rounded-[3px]", STATUS_COLOR[status])}
      title={status}
    />
  );
}

export function PublicStatusPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/status/public")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load status");
        setData(json as Payload);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const operational =
    data?.overallStatus === "operational" && (data?.incidents.filter((i) => !i.resolved_at).length ?? 0) === 0;

  const groups = React.useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Payload["components"]>();
    for (const c of data.components) {
      const g = c.group_name || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="min-h-screen bg-[#faf9f7] text-foreground">
      <header className="border-b border-border/60 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="https://vodex.dev" className="text-[15px] font-bold tracking-tight">
            Vodex <span className="text-muted-foreground font-normal">| Status</span>
          </Link>
          <a
            href="mailto:support@vodex.dev"
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-surface"
          >
            Subscribe to updates
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {error && <p className="text-destructive">{error}</p>}
        {!data && !error && <p className="text-muted-foreground">Loading status…</p>}

        {data && (
          <>
            <div
              className={cn(
                "rounded-2xl border px-6 py-8 text-center",
                operational
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-semibold",
                  operational ? "text-emerald-800" : "text-rose-800",
                )}
              >
                {operational ? "Everything is operational" : "Something's not quite right"}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                30-day history · updated {new Date().toLocaleString()}
              </p>
            </div>

            {groups.map(([group, items]) => (
              <section key={group} className="mt-10">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group}
                </h2>
                <div className="mt-3 space-y-3">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {c.current_status.replace(/_/g, " ")} · {c.uptimePercent}% uptime
                          </p>
                        </div>
                        <div className="flex gap-0.5">
                          {c.history.map((d) => (
                            <StatusSquare key={d.date} status={d.status} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="mt-12">
              <h2 className="text-[14px] font-semibold">Incidents</h2>
              {data.incidents.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">No incidents in the last 90 days.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.incidents.map((inc) => (
                    <li key={inc.id} className="rounded-xl border border-border bg-white p-4">
                      <p className="font-semibold">{inc.title}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {inc.status} · {new Date(inc.started_at).toLocaleString()}
                        {inc.resolved_at ? ` · resolved ${new Date(inc.resolved_at).toLocaleString()}` : ""}
                      </p>
                      <p className="mt-2 text-[13px]">{inc.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
