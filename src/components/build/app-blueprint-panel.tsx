"use client";

import * as React from "react";
import { Layers, ListChecks, Ban, Users, Palette, Coins, Route } from "lucide-react";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { cn } from "@/lib/utils";

const INTERNAL_RISK = /\b(supabase|vercel|backend requires|configuration)\b/i;

function safeExclusions(blueprint: AppBlueprint): string[] {
  const raw = blueprint.exclusions?.length
    ? blueprint.exclusions
    : blueprint.excludedFromBuild ?? [];
  return raw.filter((x) => !INTERNAL_RISK.test(x));
}

function safeFeatures(blueprint: AppBlueprint): string[] {
  return blueprint.primaryUserJobs.slice(0, 6);
}

function safeScreens(blueprint: AppBlueprint): Array<{ route: string; purpose: string }> {
  const routes = blueprint.routeMap ?? blueprint.pages ?? [];
  return routes.slice(0, 12).map((p) => ({
    route: p.route,
    purpose: p.purpose || "Main screen",
  }));
}

function safeRoles(blueprint: AppBlueprint): string[] {
  const fromTarget = blueprint.targetUsers
    .split(/[,;]|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (fromTarget.length >= 2) return fromTarget.slice(0, 6);
  return blueprint.primaryUserJobs.slice(0, 4);
}

function safeDataSummary(blueprint: AppBlueprint): string {
  const tables = blueprint.dataModel?.length
    ? blueprint.dataModel
    : blueprint.databaseTables ?? [];
  if (tables.length === 0) {
    return "Lightweight app data — no complex database setup needed to get started.";
  }
  const names = tables.slice(0, 5).map((t) => t.name.replace(/_/g, " "));
  const suffix = tables.length > 5 ? ` and ${tables.length - 5} more` : "";
  return `Your app will organize ${names.join(", ")}${suffix}.`;
}

export function AppBlueprintPanel({
  blueprint,
  className,
  compact,
  showCreditReserve,
}: {
  blueprint: AppBlueprint;
  className?: string;
  compact?: boolean;
  /** Quiet reserve notice near build action — not a scary estimate. */
  showCreditReserve?: boolean;
}) {
  const pitch = blueprint.oneSentencePitch ?? blueprint.corePromise ?? "";
  const exclusions = safeExclusions(blueprint);
  const screens = safeScreens(blueprint);
  const features = safeFeatures(blueprint);
  const roles = safeRoles(blueprint);
  const uiDirection = blueprint.designDirection ?? blueprint.designSystem ?? "";
  const credits = blueprint.estimatedUserCredits;
  const complexity = blueprint.estimatedComplexity;

  return (
    <div
      className={cn("rounded-xl border border-border/70 bg-surface/90 p-4", className)}
      data-testid="app-blueprint-card"
    >
      <div className="mb-4 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {blueprint.appType}
          {blueprint.category ? ` · ${blueprint.category}` : ""}
        </p>
        <h3 className="text-[17px] font-semibold text-foreground">{blueprint.appName}</h3>
        {pitch ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{pitch.slice(0, 220)}</p>
        ) : null}
      </div>

      <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "lg:grid-cols-2")}>
        <section className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Users className="size-3.5 text-accent" strokeWidth={2} />
            User roles
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <li
                key={role}
                className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
              >
                {role}
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Layers className="size-3.5 text-accent" strokeWidth={2} />
            Core systems
          </p>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            {features.map((j) => (
              <li key={j}>· {j}</li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 sm:col-span-2">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Route className="size-3.5 text-accent" strokeWidth={2} />
            Screens & routes
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {screens.map((s) => (
              <li
                key={s.route}
                className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11.5px] text-muted-foreground"
              >
                <span className="font-mono text-[10.5px] text-accent">{s.route}</span>
                <span className="mt-0.5 block text-foreground">{s.purpose}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {uiDirection ? (
        <section className="mt-4 rounded-lg border border-accent/15 bg-accent/[0.04] px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Palette className="size-3.5 text-accent" strokeWidth={2} />
            UI direction
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{uiDirection}</p>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg bg-muted/40 px-3 py-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <ListChecks className="size-3.5" strokeWidth={2} />
          Data your app will use
        </p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">{safeDataSummary(blueprint)}</p>
      </section>

      {showCreditReserve !== false && typeof credits === "number" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Coins className="size-3.5 text-accent" strokeWidth={2} />
          <span>
            Est. build: <strong className="text-foreground">{credits}</strong> credits
            {typeof complexity === "number" ? ` · complexity ${complexity}/10` : ""}
          </span>
        </div>
      ) : null}

      {exclusions.length > 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Ban className="size-3.5" strokeWidth={2} />
            First version scope
          </p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            {exclusions.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
