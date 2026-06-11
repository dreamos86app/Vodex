"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { PreviewLiveDiagnosticsSnapshot } from "@/lib/preview/preview-live-diagnostics";
import {
  buildPreviewIncidentPrompt,
  type PreviewIncidentPromptInput,
} from "@/lib/preview/build-preview-incident-prompt";
import { previewBootSucceeded } from "@/lib/preview/preview-boot-audit-types";

export function PreviewLiveDiagnosticBar({
  snapshot,
  iframeUrl,
  canonicalState,
  loadingMs,
  incidentInput,
  className,
}: {
  snapshot: PreviewLiveDiagnosticsSnapshot;
  iframeUrl?: string | null;
  canonicalState?: string;
  loadingMs?: number;
  incidentInput?: Omit<PreviewIncidentPromptInput, "liveSnapshot"> | null;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const bootOk = incidentInput?.bootAudit
    ? previewBootSucceeded(incidentInput.bootEvents ?? [], {
        iframeRemountCount: incidentInput.iframeMountCount,
      })
    : false;

  const authStuck = snapshot.entries.some(
    (e) => e.kind === "auth" && e.level === "warn" && /google|oauth|sign-in/i.test(e.message),
  );

  const hasIssues =
    authStuck ||
    (!bootOk &&
      (snapshot.errorCount > 0 ||
        snapshot.networkFailCount > 0 ||
        Boolean(incidentInput?.bootAudit.bootFailureReason)));

  const showBar = hasIssues || (loadingMs ?? 0) >= 1500 || bootOk;
  if (!showBar) return null;

  function copyFullPrompt() {
    if (!incidentInput) {
      toast.error("Diagnostics not ready yet");
      return;
    }
    const text = buildPreviewIncidentPrompt({
      ...incidentInput,
      liveSnapshot: snapshot,
      iframeUrl: incidentInput.iframeUrl ?? iframeUrl ?? null,
      canonicalState: incidentInput.canonicalState ?? canonicalState ?? null,
    });
    void navigator.clipboard.writeText(text).then(
      () => toast.success("Copied full debug prompt"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div
      className={cn(
        "absolute bottom-2 left-2 right-2 z-40 rounded-lg border text-left shadow-lg backdrop-blur-md",
        hasIssues
          ? "border-amber-500/40 bg-amber-500/10"
          : bootOk
            ? "border-emerald-500/30 bg-emerald-500/8"
            : "border-border/60 bg-background/90",
        className,
      )}
      data-testid="preview-live-diagnostic-bar"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Radio
          className={cn(
            "size-3.5 shrink-0",
            hasIssues ? "text-amber-600" : bootOk ? "text-emerald-600" : "text-accent",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
          {authStuck
            ? "App stuck on Google sign-in — redirecting to Vodex login…"
            : bootOk
            ? `Preview boot OK — ${incidentInput?.bootAudit.loadedCount ?? 0} assets loaded`
            : hasIssues
              ? `Preview blocked — ${snapshot.errorCount} error${snapshot.errorCount === 1 ? "" : "s"}`
              : `Loading preview… ${Math.round((loadingMs ?? 0) / 100) / 10}s`}
          {!bootOk && snapshot.lastBlocker ? ` · ${snapshot.lastBlocker}` : ""}
          {!bootOk && incidentInput?.bootAudit.bootFailureReason
            ? ` · ${incidentInput.bootAudit.bootFailureReason}`
            : ""}
        </span>
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {expanded ? (
        <div className="max-h-52 overflow-y-auto border-t border-border/40 px-3 py-2 text-[10px] text-muted-foreground">
          {canonicalState ? <p className="mb-1 font-mono">state={canonicalState}</p> : null}
          {iframeUrl ? (
            <p className="mb-2 truncate font-mono" title={iframeUrl}>
              src={iframeUrl}
            </p>
          ) : null}
          {incidentInput?.bootAudit ? (
            <p className="mb-2 font-mono">
              loaded={incidentInput.bootAudit.loadedCount} cancelled=
              {incidentInput.bootAudit.cancelledOrIncompleteCount} mounts=
              {incidentInput.iframeMountCount ?? 0}
            </p>
          ) : null}
          {snapshot.entries.length === 0 ? (
            <p className="flex items-center gap-1">
              <AlertTriangle className="size-3" /> No console errors captured — expand Network tab for 404s.
            </p>
          ) : (
            <ul className="mb-2 space-y-1">
              {snapshot.entries
                .slice()
                .reverse()
                .slice(0, 12)
                .map((e, i) => (
                  <li key={`${e.at}-${i}`} className={e.level === "error" ? "text-destructive" : ""}>
                    [{e.kind}] {e.message}
                    {e.rootCause ? ` — ${e.rootCause}` : ""}
                    {e.detail ? ` (${e.detail})` : ""}
                  </li>
                ))}
            </ul>
          )}
          <button
            type="button"
            onClick={copyFullPrompt}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-2 py-1.5 text-[11px] font-semibold text-accent ring-1 ring-accent/25 hover:bg-accent/15"
          >
            <Copy className="size-3" />
            Copy full debug prompt
          </button>
        </div>
      ) : null}
    </div>
  );
}
