"use client";

import * as React from "react";
import {
  Layers,
  Database,
  Shield,
  Coins,
  AlertTriangle,
  Map,
  ListChecks,
  Ban,
} from "lucide-react";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { cn } from "@/lib/utils";

export function AppBlueprintPanel({
  blueprint,
  className,
  compact,
}: {
  blueprint: AppBlueprint;
  className?: string;
  compact?: boolean;
}) {
  const pitch = blueprint.oneSentencePitch ?? blueprint.corePromise ?? "";
  const exclusions = blueprint.exclusions?.length
    ? blueprint.exclusions
    : blueprint.excludedFromBuild ?? [];
  const tables = blueprint.dataModel?.length
    ? blueprint.dataModel
    : blueprint.databaseTables ?? [];

  return (
    <div className={cn("rounded-xl border border-border/70 bg-surface/90 p-4", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            App blueprint · {blueprint.qualityLevel}
          </p>
          <h3 className="text-[16px] font-semibold text-foreground">{blueprint.appName}</h3>
          <p className="text-[12px] text-muted-foreground">
            {blueprint.appType} · {pitch.slice(0, 140)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-1 text-[11px] font-medium text-accent">
          <Coins className="size-3" />
          ~{blueprint.estimatedUserCredits} credits
        </span>
      </div>

      <div
        className={cn(
          "grid gap-3",
          compact ? "sm:grid-cols-2" : "lg:grid-cols-3",
        )}
      >
        <section className="min-w-0">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Map className="size-3" /> Routes
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-[12px] text-muted-foreground">
            {(blueprint.routeMap ?? blueprint.pages).map((p) => (
              <li key={p.route}>
                <span className="font-mono text-foreground">{p.route}</span> — {p.purpose}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Users:</span> {blueprint.targetUsers}
          </p>
        </section>

        <section className="min-w-0">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Layers className="size-3" /> Features & data
          </p>
          <ul className="text-[12px] text-muted-foreground">
            {blueprint.primaryUserJobs.slice(0, 4).map((j) => (
              <li key={j}>· {j}</li>
            ))}
          </ul>
          <p className="mb-1 mt-2 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Database className="size-3" /> Data model
          </p>
          <ul className="text-[12px] text-muted-foreground">
            {tables.length === 0 ? (
              <li>Lightweight / client-first</li>
            ) : (
              tables.map((t) => (
                <li key={t.name}>
                  {t.name} ({t.columns.length} cols)
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="min-w-0">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <ListChecks className="size-3" /> Build stages
          </p>
          <ol className="max-h-28 list-decimal space-y-0.5 overflow-y-auto pl-4 text-[11px] text-muted-foreground">
            {blueprint.buildStages.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {blueprint.buildConfidence != null ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Confidence {blueprint.buildConfidence}%
            </p>
          ) : null}
        </section>
      </div>

      {blueprint.risks.length > 0 ? (
        <div className="mt-3 flex gap-2 rounded-lg bg-warning-muted/40 px-2 py-1.5 text-[11px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          {blueprint.risks.join(" · ")}
        </div>
      ) : null}

      {exclusions.length > 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/30 px-2 py-2">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Ban className="size-3" /> What is not included
          </p>
          <p className="text-[11px] text-muted-foreground">{exclusions.join(" · ")}</p>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {blueprint.authRequired || /auth/i.test(blueprint.authModel) ? (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
            <Shield className="size-3" /> Auth
          </span>
        ) : null}
        <span>Complexity {blueprint.estimatedComplexity ?? blueprint.complexity ?? "—"}/10</span>
        {blueprint.costSavingStrategy ? (
          <span className="text-accent">{blueprint.costSavingStrategy}</span>
        ) : null}
      </div>
    </div>
  );
}
