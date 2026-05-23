"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart2, Zap, Cpu, Upload, Rocket, Loader2, Lock } from "lucide-react";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { planIncludesAnalytics } from "@/lib/pricing";

type DailyPoint = { date: string; credits: number; generations: number };
type ModelBreakdown = Record<string, number>;

type AnalyticsData = {
  daily: DailyPoint[];
  model_breakdown: ModelBreakdown;
  totals: {
    credits_used: number;
    generations: number;
    deployments: number;
    uploads: number;
  };
};

function MiniBarChart({ data, valueKey }: { data: DailyPoint[]; valueKey: "credits" | "generations" }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex h-14 items-end gap-0.5">
      {data.map((d) => {
        const h = Math.max((d[valueKey] / max) * 100, d[valueKey] > 0 ? 4 : 1);
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d[valueKey]} ${valueKey === "credits" ? "credits" : "generations"}`}
            style={{ height: `${h}%` }}
            className="flex-1 cursor-pointer rounded-sm bg-accent/30 transition hover:bg-accent/70"
          />
        );
      })}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[var(--radius-xl)] px-5 py-4 ring-1",
      accent ? "bg-accent/8 ring-accent/20" : "bg-surface ring-border",
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("size-4", accent ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-[22px] font-semibold tracking-tight", accent ? "text-accent" : "text-foreground")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AnalyticsView() {
  const { remaining } = useCreditsStore();
  const { profile } = useAuthStore();
  const planId = profile?.plan_id ?? "free";
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [upgradeRequired, setUpgradeRequired] = React.useState(false);

  React.useEffect(() => {
    if (!planIncludesAnalytics(planId)) {
      setUpgradeRequired(true);
      setLoading(false);
      return;
    }
    fetch("/api/analytics")
      .then((r) => {
        if (r.status === 403) {
          setUpgradeRequired(true);
          throw new Error("upgrade");
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => {
        if (e instanceof Error && e.message === "upgrade") setLoading(false);
        else { setError(true); setLoading(false); }
      });
  }, [planId]);

  if (upgradeRequired) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-foreground">Analytics is on Starter and above</p>
        <p className="max-w-sm text-[12.5px] text-muted-foreground">
          Upgrade to Starter to see usage trends, model breakdown, and activity after you publish apps.
        </p>
        <Link href="/pricing" className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90">
          View plans
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <BarChart2 className="size-8 text-muted-foreground/30" strokeWidth={1.25} />
        <p className="text-[13px] text-muted-foreground">Unable to load analytics</p>
        <button onClick={() => window.location.reload()} className="text-[12px] text-accent hover:underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  const noActivity =
    data.totals.generations === 0 &&
    data.totals.deployments === 0 &&
    data.totals.credits_used === 0;

  if (noActivity) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
        <BarChart2 className="size-8 text-muted-foreground/30" strokeWidth={1.25} />
        <p className="text-[14px] font-semibold text-foreground">No visits yet</p>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          Analytics will appear after people open your published app. Publish an app first, then check back here for page views and usage.
        </p>
        <Link href="/projects" className="text-[12px] font-semibold text-accent hover:underline">
          Your apps
        </Link>
      </div>
    );
  }

  const modelEntries = Object.entries(data.model_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const totalModelCredits = modelEntries.reduce((s, [, v]) => s + v, 0) || 1;

  const MODEL_COLORS = [
    "bg-accent", "bg-violet-500", "bg-cyan-500", "bg-amber-500", "bg-pink-500",
  ];

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-10"
    >
      {/* Stats grid */}
      <motion.div variants={variants.fadeUp} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Zap} label="Credits used" value={data.totals.credits_used.toLocaleString()} sub="Last 30 days" accent />
        <StatCard icon={Cpu} label="Generations" value={data.totals.generations.toLocaleString()} sub="AI messages sent" />
        <StatCard icon={Rocket} label="Deployments" value={data.totals.deployments.toLocaleString()} sub="Environments pushed" />
        <StatCard icon={Upload} label="Uploads" value={data.totals.uploads.toLocaleString()} sub="Media assets" />
      </motion.div>

      {/* Credits over time */}
      <motion.div variants={variants.fadeUp} className="rounded-[var(--radius-xl)] bg-surface p-5 ring-1 ring-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Credits used — last 30 days</h3>
            <p className="text-[12px] text-muted-foreground">Daily credit consumption</p>
          </div>
          <span className="text-[13px] font-semibold tabular-nums text-accent">
            {data.totals.credits_used.toLocaleString()}
          </span>
        </div>
        <MiniBarChart data={data.daily} valueKey="credits" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{data.daily[0]?.date?.slice(5) ?? ""}</span>
          <span>{data.daily[data.daily.length - 1]?.date?.slice(5) ?? ""}</span>
        </div>
      </motion.div>

      {/* Model breakdown */}
      {modelEntries.length > 0 && (
        <motion.div variants={variants.fadeUp} className="rounded-[var(--radius-xl)] bg-surface p-5 ring-1 ring-border">
          <h3 className="mb-4 text-[14px] font-semibold text-foreground">Credits by model</h3>
          <div className="space-y-3">
            {modelEntries.map(([model, credits], i) => (
              <div key={model}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12.5px] font-medium text-foreground">{model}</span>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {credits.toLocaleString()} credits
                    <span className="ml-1 text-muted-foreground/60">
                      ({Math.round((credits / totalModelCredits) * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", MODEL_COLORS[i])}
                    style={{ width: `${(credits / totalModelCredits) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Generations over time */}
      {data.totals.generations > 0 && (
        <motion.div variants={variants.fadeUp} className="rounded-[var(--radius-xl)] bg-surface p-5 ring-1 ring-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">AI generations — last 30 days</h3>
              <p className="text-[12px] text-muted-foreground">Messages and generations sent</p>
            </div>
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {data.totals.generations.toLocaleString()}
            </span>
          </div>
          <MiniBarChart data={data.daily} valueKey="generations" />
        </motion.div>
      )}

      {data.totals.generations === 0 && data.totals.credits_used === 0 && (
        <motion.div
          variants={variants.fadeUp}
          className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border px-8 py-16 text-center"
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
            <BarChart2 className="size-8 text-muted-foreground/40" strokeWidth={1.25} />
          </div>
          <p className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">No usage yet</p>
          <p className="mt-2 max-w-[360px] mx-auto text-[13px] leading-relaxed text-muted-foreground">
            Start building an app or sending AI messages and your credits, models, and generations will appear here in real time.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm mx-auto text-left">
            {[
              { label: "Credits used", value: "0", hint: "Last 30 days" },
              { label: "Generations", value: "0", hint: "AI messages" },
              { label: "Deployments", value: "0", hint: "Environments" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-background px-3 py-3 ring-1 ring-border">
                <p className="text-[18px] font-semibold text-foreground tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{s.hint}</p>
              </div>
            ))}
          </div>
          <a
            href="/create"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <Cpu className="size-4" strokeWidth={2} />
            Start building
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}
