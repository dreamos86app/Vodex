"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Smartphone,
  CreditCard,
  Globe,
  Plug,
  Rocket,
  Eye,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDedupe } from "@/lib/cache/fetch-dedupe";
import { OverviewPreviewThumbnailControl } from "@/components/dashboard/overview-preview-thumbnail-control";

type HealthLabel = "Excellent" | "Good" | "Needs Attention" | "Critical";

type OverviewPayload = {
  healthScore: number;
  healthLabel: HealthLabel;
  preview: { ok: boolean; label: string };
  publish: { ok: boolean; label: string };
  mobile: { score: number; label: string };
  security: { ok: boolean; label: string };
  recommendations: Array<{ id: string; title: string; detail: string; href?: string; action?: string }>;
  activity: Array<{ id: string; summary: string; at: string }>;
};

function healthTone(label: HealthLabel) {
  if (label === "Excellent") return "from-emerald-500/20 via-emerald-500/5 to-background text-emerald-700";
  if (label === "Good") return "from-sky-500/20 via-sky-500/5 to-background text-sky-700";
  if (label === "Needs Attention") return "from-amber-500/20 via-amber-500/5 to-background text-amber-800";
  return "from-red-500/20 via-red-500/5 to-background text-red-700";
}

function StatusCard({
  icon: Icon,
  title,
  value,
  ok,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  ok?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl bg-surface/90 p-4 ring-1 transition hover:shadow-md",
        ok ? "ring-emerald-500/25" : "ring-border/70",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn("size-5", ok ? "text-emerald-600" : "text-muted-foreground")} />
        {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value}</p>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        {body}
      </button>
    );
  }
  return body;
}

export function OverviewDashboardPanel({
  projectId,
  previewReady,
  publishReady,
  buildOk,
  onNavigate,
}: {
  projectId: string;
  previewReady: boolean;
  publishReady: boolean;
  buildOk: boolean;
  onNavigate?: (section: string) => void;
}) {
  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void fetchDedupe(`overview:${projectId}`, (signal) =>
      fetch(`/api/projects/${projectId}/summary`, { credentials: "include", signal }).then((r) => r.json()),
    )
      .then((json) => {
        if (cancelled) return;
        const meta = json as Record<string, unknown>;
        const mobileScore = typeof meta.mobile_readiness === "number" ? meta.mobile_readiness : 0;
        const securityOk = meta.security_ok === true;
        const serverScore = typeof meta.healthScore === "number" ? meta.healthScore : null;
        const serverLabel = meta.healthLabel as HealthLabel | undefined;
        let score = serverScore ?? 0;
        if (serverScore == null) {
          if (previewReady) score += 20;
          if (publishReady) score += 15;
          if (buildOk) score += 20;
          if (securityOk) score += 15;
          score += Math.round(mobileScore * 0.15);
          if (meta.integrations_connected) score += 15;
          if (meta.payments_connected) score += 15;
          score = Math.min(100, Math.max(0, score));
        }

        let healthLabel: HealthLabel = serverLabel ?? "Critical";
        if (!serverLabel) {
          if (score >= 85) healthLabel = "Excellent";
          else if (score >= 70) healthLabel = "Good";
          else if (score >= 45) healthLabel = "Needs Attention";
        }

        const previewOk = meta.preview_ok === true || previewReady;
        const publishOkState = meta.publish_ok === true || publishReady;

        const recs: OverviewPayload["recommendations"] = [];
        if (!meta.integrations_connected) {
          recs.push({ id: "github", title: "Connect GitHub", detail: "Sync code and enable deploy workflows.", action: "integrations" });
        }
        if (!meta.custom_domain && publishReady) {
          recs.push({ id: "domain", title: "Add custom domain", detail: "Use your own hostname for production.", action: "domains" });
        }
        if (mobileScore < 55) {
          recs.push({ id: "mobile", title: "Complete mobile setup", detail: "Configure package ID, signing, and store metadata.", action: "mobile" });
        }
        if (!previewReady && buildOk) {
          recs.push({ id: "preview", title: "Fix preview", detail: "Files are saved — run preview repair.", href: `/apps/${projectId}/builder?repair=preview` });
        }

        setData({
          healthScore: score,
          healthLabel,
          preview: { ok: previewOk, label: previewOk ? "Live" : buildOk ? "Needs repair" : "Not ready" },
          publish: { ok: publishOkState, label: publishOkState ? "Ready" : "Not yet" },
          mobile: { score: mobileScore, label: mobileScore >= 70 ? "On track" : "Setup needed" },
          security: { ok: securityOk, label: securityOk ? "Passed" : "Run scan" },
          recommendations: recs.slice(0, 4),
          activity: Array.isArray(meta.recent_activity)
            ? (meta.recent_activity as OverviewPayload["activity"]).slice(0, 6)
            : [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            healthScore: previewReady && publishReady ? 78 : 42,
            healthLabel: previewReady ? "Good" : "Needs Attention",
            preview: { ok: previewReady, label: previewReady ? "Live" : "Pending" },
            publish: { ok: publishReady, label: publishReady ? "Ready" : "Not yet" },
            mobile: { score: 0, label: "Not scanned" },
            security: { ok: false, label: "Run scan" },
            recommendations: [],
            activity: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, previewReady, publishReady, buildOk]);

  const health = data?.healthLabel ?? "Needs Attention";
  const score = data?.healthScore ?? 0;

  return (
    <div className="space-y-5" data-testid="overview-dashboard-panel">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 ring-1 ring-border/60",
          healthTone(health),
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">App Health Score</p>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Loader2 className="size-8 animate-spin" />
              ) : (
                <>
                  <motion.span
                    key={score}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-[42px] font-bold tabular-nums leading-none"
                  >
                    {score}
                  </motion.span>
                  <span className="text-[14px] font-medium opacity-70">/ 100</span>
                </>
              )}
            </div>
            <p className="mt-2 text-[13px] font-semibold">{health}</p>
          </div>
          <div className="h-16 w-16 rounded-full bg-background/40 p-1 ring-2 ring-white/30">
            <svg viewBox="0 0 36 36" className="size-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ strokeDasharray: "0 100" }}
                animate={{ strokeDasharray: `${score} 100` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
          </div>
        </div>
      </motion.div>

      <OverviewPreviewThumbnailControl projectId={projectId} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard icon={Eye} title="Preview" value={data?.preview.label ?? "—"} ok={data?.preview.ok} onClick={() => onNavigate?.("publish")} />
        <StatusCard icon={Rocket} title="Publish" value={data?.publish.label ?? "—"} ok={data?.publish.ok} onClick={() => onNavigate?.("publish")} />
        <StatusCard icon={Smartphone} title="Mobile" value={data ? `${data.mobile.score}%` : "—"} ok={(data?.mobile.score ?? 0) >= 55} onClick={() => onNavigate?.("mobile")} />
        <StatusCard icon={Shield} title="Security" value={data?.security.label ?? "—"} ok={data?.security.ok} onClick={() => onNavigate?.("security")} />
      </div>

      {data?.activity && data.activity.length > 0 ? (
        <div className="rounded-2xl bg-surface/80 p-4 ring-1 ring-border/70">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold">
            <Activity className="size-4 text-accent" /> Recent activity
          </div>
          <ul className="space-y-2">
            {data.activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="text-foreground">{a.summary}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(a.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data?.recommendations && data.recommendations.length > 0 ? (
        <div className="rounded-2xl bg-surface/80 p-4 ring-1 ring-border/70">
          <p className="mb-3 text-[12px] font-semibold text-foreground">Smart recommendations</p>
          <ul className="space-y-2">
            {data.recommendations.map((r) => (
              <li key={r.id}>
                {r.href ? (
                  <Link href={r.href} className="flex items-center justify-between rounded-xl bg-background/80 px-3 py-2.5 ring-1 ring-border/60 hover:ring-accent/30">
                    <div>
                      <p className="text-[12px] font-semibold">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => r.action && onNavigate?.(r.action)}
                    className="flex w-full items-center justify-between rounded-xl bg-background/80 px-3 py-2.5 text-left ring-1 ring-border/60 hover:ring-accent/30"
                  >
                    <div>
                      <p className="text-[12px] font-semibold">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <QuickLink icon={Plug} label="Integrations" onClick={() => onNavigate?.("integrations")} />
        <QuickLink icon={CreditCard} label="Payments" onClick={() => onNavigate?.("payments")} />
        <QuickLink icon={Globe} label="Domains" onClick={() => onNavigate?.("domains")} />
      </div>
    </div>
  );
}

function QuickLink({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-muted/30 px-3 py-2 text-[11px] font-semibold text-foreground ring-1 ring-border/60 hover:bg-muted/50"
    >
      <Icon className="size-3.5 text-accent" />
      {label}
    </button>
  );
}
