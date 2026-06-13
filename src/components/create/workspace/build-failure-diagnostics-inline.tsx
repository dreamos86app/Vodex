"use client";

import * as React from "react";
import { Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard/copy-text";
import { toast } from "@/lib/toast";
import { buildCopyFixPrompt, type BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";

function buildPreviewFixPrompt(report: Record<string, unknown>, projectId: string): string {
  return [
    "# DreamOS preview failure — fix prompt for Cursor",
    "",
    `project_id: ${projectId}`,
    "",
    "## Preview diagnostics",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    "",
    "## Requested fix",
    "Diagnose why the preview is not renderable, fix the root cause in the codebase, and ensure preview/build succeeds with an honest live UI (no placeholders).",
  ].join("\n");
}

export function BuildFailureDiagnosticsInline({
  projectId,
  jobId,
  headline,
  className,
}: {
  projectId: string;
  jobId?: string | null;
  headline?: string;
  className?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [fallbackText, setFallbackText] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/projects/${projectId}/preview/diagnostics`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: Record<string, unknown>) => {
        if (cancelled) return;
        const issues = Array.isArray(body.issues) ? (body.issues as string[]) : [];
        const renderable = body.preview_renderable === true;
        const workerStatus = String(body.latest_worker_status ?? "not started");
        const lines = [
          renderable ? "Preview is marked renderable." : "Preview is not renderable.",
          `Worker job: ${String(body.latest_worker_job ?? "none")}`,
          `Worker status: ${workerStatus}`,
          issues.length ? `Issues: ${issues.slice(0, 6).join("; ")}` : null,
        ].filter(Boolean);
        setSummary(lines.join(" "));
      })
      .catch(() => {
        if (!cancelled) setSummary("Could not load preview diagnostics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const copyFullReport = async () => {
    setCopying(true);
    try {
      const parts: string[] = [];
      if (jobId) {
        const buildRes = await fetch(
          `/api/projects/${projectId}/build-jobs/${jobId}/diagnostics`,
          { credentials: "include" },
        );
        if (buildRes.ok) {
          const body = (await buildRes.json()) as { ok?: boolean; diagnostics?: BuildDiagnosticsPayload };
          if (body.ok && body.diagnostics) {
            parts.push(buildCopyFixPrompt(body.diagnostics));
          }
        }
      }
      const previewRes = await fetch(`/api/projects/${projectId}/preview/diagnostics`, {
        credentials: "include",
      });
      const previewBody = (await previewRes.json()) as Record<string, unknown>;
      parts.push(buildPreviewFixPrompt(previewBody, projectId));
      const text = parts.filter(Boolean).join("\n\n---\n\n");
      const result = await copyTextToClipboard(text);
      if (result.ok) {
        toast.success("Copied full diagnostic report for Cursor");
        setFallbackText(null);
      } else {
        setFallbackText(text);
        toast.error("Clipboard blocked — select the text below");
      }
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      className={cn(
        "mr-6 space-y-2 rounded-xl border border-amber-500/35 bg-amber-500/[0.06] px-3 py-2.5 sm:mr-10",
        className,
      )}
      data-testid="build-failure-diagnostics-inline"
    >
      <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
        {headline ?? "Preview did not start — full diagnostic available"}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Loading diagnostic details…
        </div>
      ) : summary ? (
        <p className="text-[10.5px] leading-relaxed text-foreground/90">{summary}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void copyFullReport()}
        disabled={copying}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[10.5px] font-semibold text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-100"
      >
        {copying ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />}
        Copy full error + fix prompt for Cursor
      </button>
      {fallbackText ? (
        <textarea
          readOnly
          value={fallbackText}
          className="mt-1 h-28 w-full resize-y rounded-lg bg-background/80 p-2 font-mono text-[9px] text-foreground ring-1 ring-border"
        />
      ) : null}
    </div>
  );
}
