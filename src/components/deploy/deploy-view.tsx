"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
  ExternalLink,
  Terminal,
  History,
  ScrollText,
  Server,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PublicUrlModeBadge } from "@/components/publish/public-url-mode-badge";

type DeploymentRow = {
  id: string;
  project_id: string;
  provider: string;
  status: string;
  deployment_url: string | null;
  provider_deployment_id: string | null;
  created_at: string;
  metadata?: { error?: string; logs?: string[] } | null;
  projects?: { name?: string; published_subdomain?: string | null; custom_domain?: string | null } | null;
};

type DeploySection = "current" | "history" | "logs" | "environment" | "domains";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/60", label: "Pending" },
  building: { icon: Loader, color: "text-accent", bg: "bg-accent/10", label: "Building" },
  ready: { icon: CheckCircle, color: "text-positive", bg: "bg-positive/10", label: "Ready" },
  failed: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
  cancelled: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/60", label: "Cancelled" },
  not_deployed: { icon: Globe, color: "text-muted-foreground", bg: "bg-muted/60", label: "Not deployed" },
} as const;

const SECTIONS: Array<{ id: DeploySection; label: string; icon: React.ElementType }> = [
  { id: "current", label: "Current", icon: Rocket },
  { id: "history", label: "History", icon: History },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "environment", label: "Environment", icon: Server },
  { id: "domains", label: "Domains", icon: Link2 },
];

function DeploymentCard({ dep, vertical }: { dep: DeploymentRow; vertical?: boolean }) {
  const cfg = STATUS_CONFIG[dep.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const err = dep.metadata?.error;
  return (
    <div
      className={cn(
        "rounded-xl bg-surface p-4 ring-1 ring-border",
        vertical ? "flex flex-col gap-3" : "",
      )}
      data-testid="deployment-card"
    >
      <div className={cn("flex gap-3", vertical ? "flex-col" : "items-center")}>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
          <cfg.icon className={cn("size-4", cfg.color, dep.status === "building" && "animate-spin")} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{dep.projects?.name ?? dep.project_id.slice(0, 8)}</p>
          <p className="text-[12px] text-muted-foreground capitalize">
            {dep.provider} · {cfg.label}
          </p>
          {dep.deployment_url && dep.status === "ready" ? (
            <p className="mt-1 break-all font-mono text-[11px] text-positive">{dep.deployment_url}</p>
          ) : null}
          {err ? (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
              <Terminal className="mt-0.5 size-3 shrink-0" />
              {err}
            </p>
          ) : null}
        </div>
        {dep.deployment_url && dep.status === "ready" ? (
          <Button variant="secondary" size="sm" className="w-full shrink-0 sm:w-auto" asChild>
            <a href={dep.deployment_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DeployView() {
  const [deployments, setDeployments] = React.useState<DeploymentRow[]>([]);
  const [connection, setConnection] = React.useState<{
    state: string;
    message?: string;
    showDetails?: boolean;
    missingEnv?: string[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [section, setSection] = React.useState<DeploySection>("current");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, connRes] = await Promise.all([
        fetch("/api/deploy/history", { credentials: "include" }),
        fetch("/api/deploy/vercel/connect-status", { credentials: "include" }),
      ]);
      if (histRes.ok) {
        const data = (await histRes.json()) as { deployments?: DeploymentRow[] };
        setDeployments(data.deployments ?? []);
      }
      if (connRes.ok) setConnection(await connRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = deployments.find((d) => d.status === "ready" || d.status === "building") ?? deployments[0];
  const history = deployments;
  const logLines = deployments.flatMap((d) => {
    const logs = d.metadata?.logs;
    if (!Array.isArray(logs)) return [];
    return logs.map((line) => ({ dep: d.id, line }));
  });

  return (
    <div className="relative mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden px-3 pb-10 pt-2 sm:space-y-6 sm:px-0 sm:pt-0">
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">DEPLOYMENT</p>
          <h1 className="mt-2 text-[clamp(1.35rem,4vw,2.4rem)] font-semibold tracking-[-0.04em] text-foreground">
            Deployment Center
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {deployments.filter((d) => d.status === "ready" || d.status === "building").length} active · Vercel URLs only
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PublicUrlModeBadge />
          <Button variant="secondary" size="md" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} strokeWidth={1.75} />
          </Button>
          <Button variant="accent" size="md" className="min-w-0 flex-1 sm:flex-none" asChild>
            <a href="/projects">
              <Rocket className="size-4" strokeWidth={1.75} />
              Deploy project
            </a>
          </Button>
        </div>
      </motion.div>

      <div
        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="deploy-section-tabs"
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition",
                active ? "bg-accent/10 text-accent ring-1 ring-accent/25" : "text-muted-foreground hover:bg-surface",
              )}
            >
              <Icon className="size-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {connection && connection.showDetails !== false && section === "environment" ? (
        <div
          className={cn(
            "rounded-xl border p-4 text-[13px]",
            connection.state === "missing_env" ||
              connection.state === "token_invalid" ||
              connection.state === "needs_project_link"
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-border bg-surface/60",
          )}
        >
          <p className="font-medium">Vercel: {connection.state.replace(/_/g, " ")}</p>
          {connection.message ? <p className="mt-1 text-muted-foreground">{connection.message}</p> : null}
          {(connection.state === "missing_env" || connection.state === "token_invalid") && (
            <div className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
              <p className="font-medium text-foreground">
                Add <code className="rounded bg-muted px-1">VERCEL_ACCESS_TOKEN</code> to your server environment, then redeploy.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div key={section} variants={variants.fadeUp} initial="hidden" animate="show" className="space-y-3">
          {section === "current" ? (
            current ? (
              <DeploymentCard dep={current} vertical />
            ) : (
              <EmptyDeployState />
            )
          ) : null}

          {section === "history" ? (
            history.length === 0 ? (
              <EmptyDeployState />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {history.map((dep) => (
                  <DeploymentCard key={dep.id} dep={dep} vertical />
                ))}
              </div>
            )
          ) : null}

          {section === "logs" ? (
            logLines.length === 0 ? (
              <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
                <p className="text-[13px] text-muted-foreground">No deployment logs yet.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
                <pre className="max-h-[min(50dvh,420px)] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground">
                  {logLines.map((l, i) => (
                    <div key={`${l.dep}-${i}`}>{l.line}</div>
                  ))}
                </pre>
              </div>
            )
          ) : null}

          {section === "environment" ? (
            <div className="space-y-3">
              <EnvRow label="Provider" value="Vercel" />
              <EnvRow label="Connection" value={connection?.state?.replace(/_/g, " ") ?? "Unknown"} />
              <EnvRow
                label="Token"
                value={
                  connection?.state === "missing_env" || connection?.state === "token_invalid"
                    ? "Not configured"
                    : "Configured"
                }
              />
            </div>
          ) : null}

          {section === "domains" ? (
            deployments.length === 0 ? (
              <EmptyDeployState />
            ) : (
              <div className="space-y-2">
                {deployments
                  .filter((d) => d.deployment_url)
                  .map((d) => (
                    <div key={d.id} className="rounded-xl bg-surface p-4 ring-1 ring-border">
                      <p className="text-[12px] font-semibold text-foreground">{d.projects?.name ?? "Project"}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-positive">{d.deployment_url}</p>
                      {d.projects?.custom_domain ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">Custom: {d.projects.custom_domain}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            )
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold capitalize text-foreground">{value}</span>
    </div>
  );
}

function EmptyDeployState() {
  return (
    <div className="rounded-xl bg-surface px-6 py-12 text-center ring-1 ring-border">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
        <Rocket className="size-7 text-muted-foreground/40" strokeWidth={1.25} />
      </div>
      <p className="text-[15px] font-semibold text-foreground">No deployments yet</p>
      <p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-relaxed text-muted-foreground">
        Open a project in the builder and deploy when Vercel is connected.
      </p>
    </div>
  );
}
