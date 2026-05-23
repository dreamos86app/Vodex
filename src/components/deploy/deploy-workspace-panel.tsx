"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Rocket,
  ExternalLink,
  RefreshCw,
  Loader2,
  Terminal,
  Key,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PublicUrlModeBadge } from "@/components/publish/public-url-mode-badge";
import type { DeployCheck } from "@/components/deploy/deploy-readiness-center";

type VercelStatus = {
  status: string;
  deploymentUrl: string | null;
  providerDeploymentId?: string | null;
  logs?: unknown[];
};

type ConnectionStatus = {
  state: string;
  hasToken: boolean;
  tokenValid?: boolean | null;
  teamConfigured: boolean;
  projectLinked?: boolean;
  projectId?: string | null;
  message?: string;
  missingEnv?: string[];
};

type Props = {
  projectId: string;
  checks: DeployCheck[];
  readinessScore: number;
  className?: string;
};

export function DeployWorkspacePanel({ projectId, checks, readinessScore, className }: Props) {
  const [connection, setConnection] = React.useState<ConnectionStatus | null>(null);
  const [deployStatus, setDeployStatus] = React.useState<VercelStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deploying, setDeploying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [connRes, statusRes] = await Promise.all([
        fetch("/api/deploy/vercel/connect-status", { credentials: "include" }),
        fetch(`/api/deploy/vercel/status?projectId=${projectId}`, { credentials: "include" }),
      ]);
      if (connRes.ok) setConnection((await connRes.json()) as ConnectionStatus);
      if (statusRes.ok) setDeployStatus((await statusRes.json()) as VercelStatus);
    } catch {
      setError("Could not load deploy status");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!deployStatus || deployStatus.status !== "building") return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [deployStatus?.status, load]);

  const blockers = checks.filter((c) => c.status === "blocked");
  const vercelReady = connection?.state === "ready";
  const connectionBlocked = ["not_connected", "missing_env", "token_invalid", "needs_project_link"].includes(
    connection?.state ?? "",
  );
  const canDeploy = vercelReady && readinessScore >= 50 && blockers.length === 0;

  const startDeploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch("/api/deploy/vercel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json()) as { message?: string; deploymentUrl?: string | null; status?: string };
      if (!res.ok) {
        setError(data.message ?? "Deploy failed");
      } else {
        await load();
      }
    } catch {
      setError("Deploy request failed");
    } finally {
      setDeploying(false);
    }
  };

  const logs = Array.isArray(deployStatus?.logs) ? deployStatus.logs : [];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Advanced deploy</h2>
          <p className="text-[11px] text-muted-foreground">
            Path publish is the default. Connect Vercel only if you need external hosting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PublicUrlModeBadge />
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide Vercel" : "Show Vercel"}
          </Button>
        </div>
      </div>

      {!showAdvanced && (
        <div className="rounded-xl border border-border bg-surface/60 p-3 text-[12px] text-muted-foreground">
          Advanced deploy provider not connected. Use Publish for DreamOS86 path mode (/p/your-slug).
        </div>
      )}

      {showAdvanced && (
        <>
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading connection…
            </div>
          ) : connection ? (
            <div className="rounded-xl border border-border bg-surface/60 p-3 text-[12px]">
              <p className="font-medium text-foreground">Vercel connection</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Key className="size-3.5" />
                  Token:{" "}
                  {!connection.hasToken
                    ? "not set"
                    : connection.state === "token_invalid"
                      ? "invalid"
                      : "configured"}
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="size-3.5" />
                  Team ID: {connection.teamConfigured ? "set" : "optional — not set"}
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="size-3.5" />
                  Project ID: {connection.projectLinked || connection.projectId ? "linked" : "missing"}
                </li>
              </ul>
              {connection.message && (
                <p className="mt-2 text-[11px] text-muted-foreground">{connection.message}</p>
              )}
              {connection.state === "not_connected" && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                  Connect Vercel from Settings → Integrations when you need external hosting.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                readinessScore >= 80
                  ? "bg-positive/15 text-positive"
                  : readinessScore >= 50
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {readinessScore}% ready
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>

          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2 rounded-lg px-2 py-1.5 text-[11px] ring-1 ring-border/60">
                {c.status === "ok" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-positive" />
                ) : (
                  <AlertCircle
                    className={cn(
                      "size-3.5 shrink-0",
                      c.status === "blocked" ? "text-destructive" : "text-amber-500",
                    )}
                  />
                )}
                <span>
                  <span className="font-medium">{c.label}</span> — {c.detail}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            {connectionBlocked ? (
              <Button type="button" size="sm" variant="secondary" disabled>
                <Key className="size-3.5" />
                Connect Vercel
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={!canDeploy || deploying} onClick={() => void startDeploy()}>
                {deploying ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                Deploy
              </Button>
            )}
            {deployStatus?.status === "failed" && (
              <Button type="button" size="sm" variant="secondary" disabled={!canDeploy || deploying} onClick={() => void startDeploy()}>
                Retry deploy
              </Button>
            )}
            {deployStatus?.deploymentUrl && deployStatus.status === "ready" && (
              <Button type="button" size="sm" variant="secondary" asChild>
                <a href={deployStatus.deploymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open deployment
                </a>
              </Button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive ring-1 ring-destructive/20">
              {error}
            </p>
          )}

          {deployStatus && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-[12px] font-medium">
                Status: <span className="capitalize">{deployStatus.status.replace(/_/g, " ")}</span>
              </p>
              {deployStatus.deploymentUrl ? (
                <p className="mt-1 truncate font-mono text-[11px] text-positive">{deployStatus.deploymentUrl}</p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">No live URL yet</p>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Deployment URLs are only from Vercel after a real deploy — never fabricated.
              </p>
            </div>
          )}

          {logs.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-2">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold">
                <Terminal className="size-3.5" />
                Deployment logs
              </p>
              <pre className="max-h-32 overflow-auto text-[10px] text-muted-foreground">
                {JSON.stringify(logs, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
