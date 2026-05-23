"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Rocket,
  GitBranch,
  Key,
  Database,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DeployCheck = {
  id: string;
  label: string;
  status: "ok" | "warning" | "blocked";
  detail: string;
  fixHref?: string;
};

type Props = {
  projectId: string;
  checks: DeployCheck[];
  readinessScore: number;
  providerConnected?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function DeployReadinessCenter({
  checks,
  readinessScore,
  providerConnected = false,
  onRefresh,
  className,
}: Props) {
  const blockers = checks.filter((c) => c.status === "blocked");

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Deploy readiness</h2>
          <p className="text-[12px] text-muted-foreground">
            Real checks only — we never mark deployed unless a provider confirms it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold",
              readinessScore >= 80
                ? "bg-positive-muted text-positive"
                : readinessScore >= 50
                  ? "bg-warning-muted text-warning"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {readinessScore}% ready
          </span>
          {onRefresh ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
              Re-run checks
            </Button>
          ) : null}
        </div>
      </div>

      {!providerConnected ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[13px] font-medium text-foreground">Deployment provider not connected</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Export your project, connect GitHub, or link Vercel/Netlify before one-click deploy.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" asChild>
              <a href="/settings/integrations">Connect provider</a>
            </Button>
            <Button type="button" variant="ghost" size="sm">
              Export project
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {checks.map((c) => (
          <li
            key={c.id}
            className="flex gap-3 rounded-xl border border-border/60 bg-surface/60 px-3 py-2.5"
          >
            {c.status === "ok" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
            ) : (
              <AlertCircle
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  c.status === "blocked" ? "text-destructive" : "text-warning",
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{c.label}</p>
              <p className="text-[12px] text-muted-foreground">{c.detail}</p>
              {c.fixHref ? (
                <a href={c.fixHref} className="mt-1 inline-block text-[12px] text-accent hover:underline">
                  Fix →
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {blockers.length > 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {blockers.length} blocker{blockers.length === 1 ? "" : "s"} must be resolved before deploy.
        </p>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-accent-muted/40 px-3 py-2 text-[12px] text-foreground">
          <Rocket className="size-4 text-accent" />
          Checks passed — you can prepare deployment when your provider is connected.
        </div>
      )}
    </div>
  );
}

export const DEPLOY_CHECK_ICONS = {
  framework: Package,
  env: Key,
  database: Database,
  github: GitBranch,
} as const;
