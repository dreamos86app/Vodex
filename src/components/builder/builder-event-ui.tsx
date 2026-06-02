"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  FilePlus,
  FilePen,
  Loader2,
  ListChecks,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildPlanCard } from "@/lib/creation/parse-build-plan";
import type { BuilderOutputContract } from "@/lib/creation/parse-builder-metadata";
import { stripMarkdownNoise } from "@/lib/projects/project-context";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";

export function QueuedPromptCard({
  text,
  paused = false,
  onCancel,
  onPause,
  onResume,
  onEdit,
  className,
}: {
  text: string;
  paused?: boolean;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEdit?: (next: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);

  React.useEffect(() => {
    setDraft(text);
  }, [text]);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3 py-2.5 ring-1",
        paused
          ? "bg-muted/40 ring-border/60"
          : "bg-accent/[0.06] ring-accent/20",
        className,
      )}
    >
      <Clock className={cn("mt-0.5 size-4 shrink-0", paused ? "text-muted-foreground" : "text-accent")} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-semibold", paused ? "text-muted-foreground" : "text-accent")}>
          {paused ? "Paused" : "Queued"}
        </p>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg bg-background px-2 py-1.5 text-[12px] ring-1 ring-border focus:outline-none focus:ring-accent/40"
          />
        ) : (
          <p className="mt-0.5 line-clamp-3 text-[12px] text-foreground">{text}</p>
        )}
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          {paused ? "Resume to run after the current build" : "Runs when the current build finishes"}
        </p>
        {editing && onEdit ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const next = draft.trim();
                if (next) onEdit(next);
                setEditing(false);
              }}
              className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {onEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            Edit
          </button>
        ) : null}
        {paused && onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="rounded-md px-1.5 py-1 text-[10px] font-medium text-accent transition hover:bg-accent/10"
          >
            Resume
          </button>
        ) : onPause ? (
          <button
            type="button"
            onClick={onPause}
            className="rounded-md px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            Pause
          </button>
        ) : null}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label="Remove queued prompt"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BuilderPlanCard({
  plan,
  className,
}: {
  plan: BuildPlanCard;
  className?: string;
}) {
  const steps = plan.taskLabels.slice(0, 6);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-gradient-to-br from-accent/[0.08] via-background to-sky-500/[0.06] ring-1 ring-accent/20",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border/60 px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-accent" strokeWidth={1.75} />
          <p className="text-[12px] font-semibold text-foreground">
            {plan.summary ? "Build plan" : `I'll build this in ${steps.length} steps`}
          </p>
        </div>
        {plan.summary && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{plan.summary}</p>
        )}
      </motion.div>
      <ul className="space-y-0.5 px-3 py-2">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-[12px] text-foreground/90">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BuilderStepCard({
  label,
  description,
  status,
}: {
  label: string;
  description?: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <motion.div
      layout
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3 py-2 ring-1 transition",
        status === "active" && "bg-accent/[0.08] ring-accent/30 shadow-[0_0_20px_-8px_hsl(var(--accent)/0.5)]",
        status === "done" && "bg-surface/80 ring-border/80",
        status === "pending" && "bg-surface/40 ring-border/50 opacity-70",
      )}
    >
      {status === "done" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
      ) : status === "active" ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-accent" strokeWidth={2} />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    </motion.div>
  );
}

export function BuilderProgressTimeline({
  labels,
  activeIndex,
  className,
}: {
  labels: string[];
  activeIndex: number;
  className?: string;
}) {
  const descriptions = [
    "Architecture, routes, and scope",
    "Name, icon, and brand direction",
    "Layouts, navigation, and UI",
    "Tables, fields, and relationships",
    "API routes and server actions",
    "Preview compile and packaging",
    "Final polish and handoff",
  ];
  return (
    <motion.div className={cn("space-y-1.5", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {labels.map((label, i) => (
        <BuilderStepCard
          key={`${label}-${i}`}
          label={label}
          description={descriptions[i] ?? undefined}
          status={i < activeIndex ? "done" : i === activeIndex ? "active" : "pending"}
        />
      ))}
    </motion.div>
  );
}

export function BuilderActionRow({
  action,
  path,
}: {
  action: "created" | "updated" | "read" | "tested" | "fixed";
  path: string;
}) {
  const Icon = action === "updated" ? FilePen : FilePlus;
  const verb =
    action === "created"
      ? "Created"
      : action === "updated"
        ? "Updated"
        : action === "read"
          ? "Read"
          : action === "tested"
            ? "Tested"
            : "Fixed";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface/60 px-2.5 py-1.5 text-[11.5px] ring-1 ring-border/60">
      <Icon className="size-3.5 shrink-0 text-accent/80" strokeWidth={1.75} />
      <span className="text-muted-foreground">{verb}</span>
      <code className="truncate font-mono text-[11px] text-foreground">{path}</code>
    </div>
  );
}

export function BuilderFileChangeList({ files }: { files: Array<{ path: string; action?: string }> }) {
  if (!files.length) return null;
  return (
    <motion.div className="space-y-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {files.slice(0, 12).map((f) => (
        <BuilderActionRow
          key={f.path}
          action={f.action === "updated" ? "updated" : "created"}
          path={f.path}
        />
      ))}
      {files.length > 12 && (
        <p className="px-1 text-[10.5px] text-muted-foreground">+{files.length - 12} more in Code tab</p>
      )}
    </motion.div>
  );
}

export function BuilderResultSummary({
  meta,
  creditsUsed,
  previewReady = false,
  className,
}: {
  meta: BuilderOutputContract | null;
  creditsUsed?: number | null;
  previewReady?: boolean;
  className?: string;
}) {
  if (!meta?.app?.name && !meta?.summary) return null;
  const appName = meta.app?.name ? stripMarkdownNoise(meta.app.name) : null;
  const headline = previewReady
    ? `Done — ${appName ? `I created ${appName}` : "Build complete"}`
    : `Build saved — ${appName ?? "your app"} needs a preview fix`;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-gradient-to-br from-accent/10 via-background to-violet-500/[0.06] ring-1 ring-accent/25",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 px-3 py-3"
      >
        <motion.div
          className="flex size-9 shrink-0 items-center justify-center"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <VodexBrandIcon variant="assistant" alt="" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{headline}</p>
          {meta.summary ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {previewReady
                ? meta.summary
                : "Files are saved. Use repair or retry preview when the build finishes."}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(meta.pages?.length ?? 0) > 0 && (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-border">
                {meta.pages!.length} screens
              </span>
            )}
            {(meta.entities?.length ?? 0) > 0 && (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-border">
                {meta.entities!.length} entities
              </span>
            )}
            {typeof creditsUsed === "number" && creditsUsed > 0 && (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground ring-1 ring-border">
                {creditsUsed} credits used
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function parseActionRowsFromText(text: string): Array<{ path: string; action: string }> {
  const rows: Array<{ path: string; action: string }> = [];
  const re = /```[\w]*\s+file=([^\s`]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    rows.push({ path: m[1]!, action: "created" });
  }
  const verbs = [
    /(?:Created|Wrote)\s+([^\s\n]+\.[a-z0-9]+)/gi,
    /(?:Edited|Updated)\s+([^\s\n]+\.[a-z0-9]+)/gi,
    /(?:Read)\s+([^\s\n]+\.[a-z0-9]+)/gi,
  ];
  for (const rx of verbs) {
    while ((m = rx.exec(text)) !== null) {
      const path = m[1]!;
      const action = rx.source.includes("Edited") ? "updated" : rx.source.includes("Read") ? "read" : "created";
      if (!rows.some((r) => r.path === path)) rows.push({ path, action });
    }
  }
  return rows.slice(0, 16);
}

/** Single canonical build workflow — no duplicate plan + checklist. */
export function BuilderAssistantMessage({
  text,
  streaming,
  meta,
  plan,
  progressIndex: _progressIndex,
  creditsUsed,
  buildFinalized,
  previewReady = false,
}: {
  text: string;
  streaming?: boolean;
  meta: BuilderOutputContract | null;
  plan: BuildPlanCard;
  progressIndex: number;
  creditsUsed?: number | null;
  buildFinalized?: boolean;
  previewReady?: boolean;
}) {
  const appName = meta?.app?.name ? stripMarkdownNoise(meta.app.name) : plan.summary?.slice(0, 48);
  const fileRows =
    meta?.files?.map((f) =>
      typeof f === "string" ? { path: f, action: "created" } : { path: f.path, action: f.action ?? "created" },
    ) ?? parseActionRowsFromText(text);

  const showThinking = streaming && fileRows.length === 0;
  const showDone = !streaming && buildFinalized !== false;

  return (
    <div className="space-y-2.5">
      {(appName || plan.summary) && (
        <div className="rounded-xl bg-gradient-to-br from-accent/[0.06] via-background to-sky-500/[0.05] px-3 py-2.5 ring-1 ring-accent/20">
          <p className="text-[12px] font-semibold text-foreground">
            {streaming ? "Planning" : "Build plan"}
            {appName ? ` · ${appName}` : ""}
          </p>
          {plan.summary && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{plan.summary}</p>
          )}
        </div>
      )}

      {showThinking && (
        <div className="flex items-center gap-2 rounded-xl bg-surface/80 px-3 py-2 ring-1 ring-border/60">
          <Loader2 className="size-3.5 animate-spin text-accent" />
          <span className="text-[12px] text-muted-foreground">Thinking and generating…</span>
        </div>
      )}

      {fileRows.length > 0 && (
        <div className="space-y-1 rounded-xl bg-white/60 px-2 py-2 ring-1 ring-border/70 dark:bg-surface/40">
          {fileRows.map((f) => (
            <BuilderActionRow
              key={f.path}
              action={
                f.action === "updated" ? "updated" : f.action === "read" ? "read" : "created"
              }
              path={f.path}
            />
          ))}
        </div>
      )}

      {showDone && (
        <BuilderResultSummary meta={meta} creditsUsed={creditsUsed} previewReady={previewReady} />
      )}
      {streaming && !showDone && fileRows.length > 0 && (
        <p className="text-[10.5px] text-muted-foreground">Saving files and preparing preview…</p>
      )}
    </div>
  );
}
