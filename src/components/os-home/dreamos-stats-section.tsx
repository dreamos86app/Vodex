"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PublicStatsResponse } from "@/app/api/public/stats/route";
import { showcaseStatsFallback } from "@/lib/public/platform-showcase-stats";

const FETCH_TIMEOUT_MS = 4_000;

function StatSkeleton() {
  return (
    <div className="flex min-h-[168px] animate-pulse flex-col justify-between rounded-[1.35rem] border border-border/60 bg-muted/20 p-6">
      <div className="h-10 w-24 rounded-lg bg-muted/50" />
      <div className="h-4 w-40 rounded bg-muted/40" />
    </div>
  );
}

function StatCard({
  value,
  label,
  suffix,
  className,
}: {
  value: string;
  label: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "flex min-h-[168px] flex-col justify-between rounded-[1.35rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-blue-50/90 p-6 shadow-[0_0_40px_-12px_rgba(59,130,246,0.35)] ring-1 ring-sky-100/80 dark:border-accent/25 dark:from-accent/10 dark:via-background dark:to-indigo-950/30 dark:shadow-[0_0_48px_-16px_hsl(var(--accent)/0.35)]",
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[clamp(2.25rem,5vw,3.25rem)] font-semibold tabular-nums leading-none tracking-[-0.04em] text-foreground">
        {value}
        {suffix ?? ""}
      </p>
      <p className="max-w-[14rem] text-[13px] leading-snug text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function buildCards(stats: PublicStatsResponse) {
  return [
    {
      value: (stats.projectsStarted ?? 0).toLocaleString(),
      suffix: "+",
      label: "projects started on DreamOS86",
    },
    {
      value: (stats.dailyVisits ?? 0).toLocaleString(),
      suffix: "+",
      label: "daily visits across published apps",
    },
    {
      value: formatTotalVisits(stats.totalVisits ?? 0),
      suffix: "+",
      label: "total visits across all projects",
    },
  ];
}

function formatTotalVisits(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}m` : `${m.toFixed(1).replace(/\.0$/, "")}m`;
  }
  return n.toLocaleString();
}

export function DreamOsStatsSection() {
  const [state, setState] = React.useState<"loading" | "ready">("loading");
  const [stats, setStats] = React.useState<PublicStatsResponse>(() => {
    const fb = showcaseStatsFallback();
    return {
      ok: true,
      projectsStarted: fb.projectsStarted,
      projectsLaunched: fb.projectsLaunched,
      dailyVisits: fb.dailyVisits,
      totalVisits: fb.totalVisits,
      visitsAvailable: true,
      source: "showcase",
    };
  });

  React.useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const timeout = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

    void fetch("/api/public/stats", { cache: "no-store", signal: ac.signal })
      .then((r) => r.json())
      .then((body: PublicStatsResponse) => {
        if (cancelled) return;
        if (body.ok) setStats(body);
      })
      .catch(() => {
        /* keep showcase defaults already in state */
      })
      .finally(() => {
        if (!cancelled) {
          setState("ready");
          window.clearTimeout(timeout);
        }
      });

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const cards = buildCards(stats);

  return (
    <section
      data-testid="dreamos-stats-section"
      className="relative w-full overflow-hidden rounded-[1.75rem] px-5 py-10 sm:px-8 sm:py-12"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-blue-50 dark:from-accent/15 dark:via-background dark:to-indigo-950/40"
        aria-hidden
      />
      <div className="relative">
        <motion.div
          className="mb-8 flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent ring-1 ring-accent/25">
            Momentum
          </span>
          <h2 className="text-balance text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">
            DreamOS86 in numbers
          </h2>
          <p className="max-w-lg text-pretty text-[14px] text-muted-foreground">
            Track DreamOS86 momentum as apps are created, imported, and published.
          </p>
        </motion.div>

        {state === "loading" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cards.map((s) => (
              <StatCard key={s.label} value={s.value} label={s.label} suffix={s.suffix} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
