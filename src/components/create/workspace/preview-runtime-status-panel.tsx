"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import {
  previewRuntimeStateLabel,
  VITE_BUILD_OOM_CODE,
} from "@/lib/preview/preview-runtime-status";
import { Button } from "@/components/ui/button";

export function PreviewRuntimeStatusPanel({
  status,
  compact,
  className,
  onRebuild,
  rebuilding,
}: {
  status: PreviewRuntimeStatusPayload;
  compact?: boolean;
  className?: string;
  onRebuild?: () => void;
  rebuilding?: boolean;
}) {
  const [logsOpen, setLogsOpen] = React.useState(false);
  const label = previewRuntimeStateLabel(status);
  const pending =
    status.jobStatus === "queued" ||
    status.jobStatus === "running" ||
    status.previewStatus === "queued";

  if (status.previewRenderable && !compact) return null;

  const oom =
    status.errorCode === VITE_BUILD_OOM_CODE ||
    status.blockedReason === "Vite build out of memory";
  const subline =
    oom
      ? (status.userMessage ??
        "This ZIP is too large for the current preview worker memory. Increase worker memory or reduce bundle size.")
      : status.workerUnavailable && (status.jobStatus === "queued" || status.previewStatus === "queued")
        ? (status.workerUnavailableMessage ??
          (status.requiresDeployedWorker
            ? "Deploy the preview worker for production builds."
            : "Start the preview worker locally."))
        : status.blockedReason ?? "Waiting for a renderable preview build.";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-[11px]",
        status.previewRenderable
          ? "border-positive/30 bg-positive/5"
          : pending
            ? status.workerUnavailable && !status.workerConnected
              ? "border-destructive/30 bg-destructive/8"
              : "border-accent/30 bg-accent/8"
            : "border-amber-500/30 bg-amber-500/8",
        className,
      )}
      data-testid="preview-runtime-status-panel"
    >
      <div className="flex items-start gap-2">
        {pending ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent" />
        ) : (
          <Server className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{label}</p>
          {!compact && <p className="mt-0.5 text-muted-foreground">{subline}</p>}
          {!compact && status.jobAgeLabel && status.jobStatus === "queued" && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/80">
              Queued {status.jobAgeLabel}
              {status.workerConnected ? " · worker connected" : " · no worker heartbeat"}
            </p>
          )}
        </div>
        {onRebuild && !compact && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[10px]"
            disabled={rebuilding || (pending && status.workerConnected && !status.workerUnavailable)}
            onClick={onRebuild}
          >
            {rebuilding ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Rebuild
          </Button>
        )}
      </div>

      <dl className={cn("mt-2 grid gap-1", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        <Item label="Job" value={status.jobId ?? "—"} />
        <Item label="Job status" value={status.jobStatus ?? status.previewStatus} />
        {status.jobAgeLabel ? <Item label="Queue age" value={status.jobAgeLabel} /> : null}
        <Item label="Framework" value={status.frameworkLabel ?? status.framework ?? "—"} />
        <Item label="Artifact" value={status.artifactPath ?? "—"} mono />
        <Item label="Renderable" value={status.previewRenderable ? "yes" : "no"} />
        <Item label="Honest" value={status.previewHonest ? "yes" : "no"} />
        <Item
          label="Worker"
          value={
            status.workerConnected
              ? "Connected"
              : status.workerUnavailable
                ? status.requiresDeployedWorker
                  ? "Not deployed"
                  : "Not connected"
                : "Unknown"
          }
        />
        {status.lockedBy ? <Item label="Locked by" value={status.lockedBy} mono /> : null}
        {status.estimatedActionCredits != null ? (
          <Item label="Estimated cost" value={`${status.estimatedActionCredits} AC`} />
        ) : null}
        <Item
          label="Charged"
          value={
            status.creditsCharged
              ? "Yes"
              : status.chargeStatus === "cancelled" || status.chargeStatus === "refunded"
                ? "No"
                : status.chargeStatus === "pending"
                  ? "No (reserved)"
                  : "No"
          }
        />
        {status.chargeStatus ? (
          <Item
            label="Charge status"
            value={
              status.chargeStatus === "pending"
                ? "Pending"
                : status.chargeStatus === "charged"
                  ? "Charged"
                  : status.chargeStatus === "refunded"
                    ? "Refunded"
                    : status.chargeStatus === "cancelled"
                      ? "Cancelled"
                      : "—"
            }
          />
        ) : null}
        {status.chargedActionCredits != null ? (
          <Item label="Charged amount" value={`${status.chargedActionCredits} AC`} />
        ) : null}
      </dl>

      {(() => {
        const repair = status.packageRepairDiagnostics ?? status.previewBuildMeta?.packageRepair;
        const meta = status.previewBuildMeta;
        if (!repair && !meta?.installCommand) return null;
        return (
          <dl className="mt-2 grid gap-1 border-t border-border/60 pt-2 sm:grid-cols-2">
            <Item label="Package repair executed" value={repair?.executed === true ? "yes" : repair ? "no" : "—"} />
            <Item label="Vite injected" value={repair?.viteInjected === true ? "yes" : "no"} />
            <Item
              label="Vite binary exists"
              value={
                repair?.afterInstall?.viteBinaryExists === true
                  ? "yes"
                  : repair?.afterInstall
                    ? "no"
                    : "—"
              }
            />
            {meta?.npmProjectRoot ? <Item label="npm cwd" value={meta.npmProjectRoot} mono /> : null}
            {meta?.packageJsonRelative ? (
              <Item label="package.json" value={meta.packageJsonRelative} mono />
            ) : null}
            {meta?.installCommand ? <Item label="Install" value={meta.installCommand} mono /> : null}
            {meta?.buildCommand ? <Item label="Build" value={meta.buildCommand} mono /> : null}
            {meta?.nodeOptions ? <Item label="NODE_OPTIONS" value={meta.nodeOptions} mono /> : null}
            {status.errorCode ? <Item label="Error code" value={status.errorCode} mono /> : null}
            {repair?.errorCode ? <Item label="Repair error" value={repair.errorCode} mono /> : null}
            {repair?.summary ? (
              <div className="sm:col-span-2">
                <Item label="Repair summary" value={repair.summary} />
              </div>
            ) : null}
          </dl>
        );
      })()}

      {status.buildLogs ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-[10px] font-medium text-muted-foreground"
            onClick={() => setLogsOpen((o) => !o)}
          >
            Build logs
            {logsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {logsOpen && (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[9px] text-muted-foreground">
              {status.buildLogs}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium text-foreground", mono && "font-mono text-[10px]")}>
        {value}
      </dd>
    </div>
  );
}
