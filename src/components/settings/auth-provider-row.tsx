"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Circle, Lock, ExternalLink, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type AuthProviderRowProps = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled?: boolean;
  health: "ok" | "warn" | "off" | "loading";
  statusBadge?: string;
  locked?: boolean;
  lockBadge?: string;
  showToggle?: boolean;
  toggleDisabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onConfigure?: () => void;
  configureLabel?: string;
  docsHref?: string;
  lastChecked?: string | null;
  nested?: boolean;
  testId?: string;
};

export function AuthProviderRow({
  id,
  icon,
  title,
  description,
  enabled = false,
  health,
  statusBadge,
  locked = false,
  lockBadge,
  showToggle = true,
  toggleDisabled = false,
  onToggle,
  onConfigure,
  configureLabel = "Configure",
  docsHref,
  lastChecked,
  nested = false,
  testId,
}: AuthProviderRowProps) {
  const HealthIcon =
    health === "loading" ? Loader2 : health === "ok" ? CheckCircle2 : health === "warn" ? AlertTriangle : Circle;

  return (
    <div
      data-testid={testId ?? `auth-provider-row-${id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-xl bg-surface/90 px-4 py-3.5 ring-1 transition",
        enabled && !locked ? "ring-accent/35 shadow-[0_0_0_1px_rgba(30,107,255,0.08)]" : "ring-border/70",
        nested && "ml-6 border-l-2 border-accent/20",
        "hover:ring-accent/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border/60 transition",
              enabled && "ring-accent/30 bg-accent/[0.06]",
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-foreground">{title}</p>
              {statusBadge ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {statusBadge}
                </span>
              ) : null}
              {lockBadge ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                  <Lock className="size-3" />
                  {lockBadge}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <HealthIcon
                className={cn(
                  "size-3.5 shrink-0",
                  health === "loading" && "animate-spin",
                  health === "ok" && "text-emerald-600",
                  health === "warn" && "text-amber-600",
                  health === "off" && "text-muted-foreground",
                )}
              />
              {health === "ok" ? "Healthy" : health === "warn" ? "Needs attention" : health === "loading" ? "Checking…" : "Disabled"}
              {lastChecked ? ` · Last checked ${lastChecked}` : ""}
            </p>
          </div>
        </div>

        {showToggle && onToggle && !locked ? (
          <Switch
            checked={enabled}
            disabled={toggleDisabled || health === "loading"}
            onCheckedChange={onToggle}
            aria-label={`Enable ${title}`}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[52px]">
        {onConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            disabled={locked}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              locked
                ? "cursor-not-allowed bg-muted/40 text-muted-foreground ring-border"
                : "bg-background text-foreground ring-border hover:bg-accent/8 hover:ring-accent/30 active:scale-[0.98]",
            )}
          >
            {locked ? "Upgrade to configure" : configureLabel}
          </button>
        ) : null}
        {docsHref ? (
          <Link
            href={docsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-accent"
          >
            Docs
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
