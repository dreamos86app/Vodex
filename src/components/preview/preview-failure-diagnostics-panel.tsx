"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileCode2,
  Package,
  Route,
  ServerCrash,
  Wrench,
  CloudOff,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanonicalBuildState } from "@/lib/build/canonical-build-state";

type DiagnosticItem = {
  id: string;
  label: string;
  detail: string;
  icon: React.ElementType;
  severity: "error" | "warn";
};

function itemsFromState(state: CanonicalBuildState | null, extras?: string[]): DiagnosticItem[] {
  if (!state) {
    return [
      {
        id: "loading",
        label: "Checking preview state",
        detail: "Loading build status…",
        icon: ServerCrash,
        severity: "warn",
      },
    ];
  }

  const out: DiagnosticItem[] = [];
  const { checks, blockers } = state;

  if (checks.files === "fail") {
    out.push({
      id: "files",
      label: "No app files",
      detail: "The build did not persist generated source files.",
      icon: FileCode2,
      severity: "error",
    });
  }
  if (checks.packageJson === "fail") {
    out.push({
      id: "package",
      label: "Missing package.json",
      detail: "A valid package.json is required for preview and publish.",
      icon: Package,
      severity: "error",
    });
  }
  if (checks.mainPage === "fail") {
    out.push({
      id: "page",
      label: "Missing main page",
      detail: "No page.tsx / page.jsx route was found in the project.",
      icon: Route,
      severity: "error",
    });
  }
  if (checks.sourceIntegrity === "fail") {
    out.push({
      id: "integrity",
      label: "Source integrity failed",
      detail: blockers.find((b) => /integrity|thin|incomplete/i.test(b)) ?? "Source files are empty or too thin to render.",
      icon: Wrench,
      severity: "error",
    });
  }
  if (checks.preview === "fail") {
    out.push({
      id: "preview",
      label: "Preview render failed",
      detail: "The preview worker could not render a live snapshot.",
      icon: ServerCrash,
      severity: "error",
    });
  }
  if (checks.preview === "warn") {
    out.push({
      id: "preview_pending",
      label: "Preview not started",
      detail: "Files exist — start or retry preview from the builder.",
      icon: CloudOff,
      severity: "warn",
    });
  }

  for (const extra of extras ?? []) {
    if (/worker|unavailable/i.test(extra)) {
      out.push({ id: "worker", label: "Preview worker unavailable", detail: extra, icon: CloudOff, severity: "error" });
    } else if (/upload|artifact/i.test(extra)) {
      out.push({ id: "artifact", label: "Artifact upload failed", detail: extra, icon: Upload, severity: "error" });
    }
  }

  if (out.length === 0 && state.blockers.length > 0) {
    out.push({
      id: "generic",
      label: "Preview blocked",
      detail: state.blockers[0]!,
      icon: AlertTriangle,
      severity: "error",
    });
  }

  return out;
}

export function PreviewFailureDiagnosticsPanel({
  state,
  projectId,
  extraMessages,
  className,
}: {
  state: CanonicalBuildState | null;
  projectId?: string;
  extraMessages?: string[];
  className?: string;
}) {
  const items = itemsFromState(state, extraMessages);
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex min-h-[min(50vh,420px)] flex-col items-center justify-center gap-4 px-4 py-8 text-center",
        className,
      )}
      data-testid="preview-failure-diagnostics"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/25">
        <AlertTriangle className="size-6 text-destructive" strokeWidth={1.5} />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-[15px] font-semibold text-foreground">Preview could not load</p>
        <p className="text-[13px] text-muted-foreground">
          We found specific issues — nothing is hidden behind a blank screen.
        </p>
      </div>
      <ul className="w-full max-w-lg space-y-2 text-left">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className={cn(
                "flex gap-3 rounded-xl px-3 py-2.5 ring-1",
                item.severity === "error"
                  ? "bg-destructive/5 ring-destructive/20"
                  : "bg-amber-500/5 ring-amber-500/25",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  item.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-300",
                )}
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {projectId ? (
        <Link
          href={`/apps/${projectId}/builder`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent/90"
        >
          <Wrench className="size-3.5" />
          Open builder to repair
        </Link>
      ) : null}
    </div>
  );
}
