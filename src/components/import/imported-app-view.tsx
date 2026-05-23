"use client";

import * as React from "react";
import { Package, Route, Terminal, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportedAppMeta = {
  framework?: { label?: string; id?: string };
  routes?: string[];
  scripts?: { dev?: string; build?: string; start?: string };
  package_manager?: string;
  quality_score?: number;
  preview_ready?: boolean;
  publish_ready?: boolean;
  warnings?: string[];
  rejected_secrets?: string[];
  file_count?: number;
  env_requirements?: Array<string | { key: string; public?: boolean }>;
};

export function ImportedAppView({
  meta,
  filePaths = [],
  projectId,
}: {
  meta: ImportedAppMeta;
  filePaths?: string[];
  projectId: string;
}) {
  const score = meta.quality_score ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 ring-1 ring-violet-500/20">
        <Package className="size-4 text-violet-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-foreground">Imported ZIP</p>
          <p className="text-[10px] text-muted-foreground">
            {meta.framework?.label ?? "App"} · {meta.file_count ?? filePaths.length} files · quality {score}/100
          </p>
        </div>
        {score >= 90 ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">90+</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat icon={Route} label="Routes" value={String(meta.routes?.length ?? 0)} />
        <MiniStat icon={Terminal} label="Build script" value={meta.scripts?.build ? "Yes" : "—"} ok={Boolean(meta.scripts?.build)} />
        <MiniStat icon={CheckCircle2} label="Preview" value={meta.preview_ready ? "Ready" : "Pending"} ok={meta.preview_ready} />
        <MiniStat icon={KeyRound} label="Env vars" value={String(meta.warnings?.filter((w) => w.includes("env")).length ?? 0) || "Checklist"} />
      </div>

      {meta.routes && meta.routes.length > 0 && (
        <div className="rounded-xl ring-1 ring-border/70 bg-background/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Detected routes</p>
          <ul className="mt-2 space-y-1 font-mono text-[10px] text-foreground">
            {meta.routes.slice(0, 12).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {meta.warnings && meta.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {meta.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-200">
              <AlertTriangle className="size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {filePaths.length > 0 && (
        <div className="rounded-xl ring-1 ring-border/70 bg-background/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">File tree (sample)</p>
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] text-muted-foreground">
            {filePaths.slice(0, 24).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Project <span className="font-mono">{projectId.slice(0, 8)}…</span> — open Builder to edit or publish when ready.
      </p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-border/70">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className={cn("size-3", ok && "text-emerald-600")} />
        <span className="text-[9px] font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-0.5 text-[12px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
