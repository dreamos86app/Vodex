"use client";

import * as React from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { PreviewToolbar } from "@/components/preview/preview-toolbar";
import { PreviewStatusPanel } from "@/components/preview/preview-status-panel";
import { PREVIEW_LEVEL_LABELS, type PreviewProviderLevel } from "@/lib/preview/preview-provider-types";
import { cn } from "@/lib/utils";

type PreviewUiStatus = "idle" | "starting" | "ready" | "failed";

function inAppPreviewSrc(sessionId: string | null, externalUrl: string | null): string | null {
  if (externalUrl?.startsWith("http")) return externalUrl;
  if (sessionId) return `/preview/${sessionId}`;
  return null;
}

function safeShareUrl(sessionId: string | null, externalUrl: string | null): string | null {
  if (externalUrl?.startsWith("http")) return externalUrl;
  if (sessionId && typeof window !== "undefined") {
    return `${window.location.origin}/preview/${sessionId}`;
  }
  return null;
}

export function PreviewWorkspace({
  projectId,
  previewUrl,
  autoStart = false,
  hasGenerated = false,
  isImported = false,
  lifecycleStatus,
  className,
}: {
  projectId: string;
  previewUrl?: string | null;
  autoStart?: boolean;
  hasGenerated?: boolean;
  isImported?: boolean;
  lifecycleStatus?: string | null;
  className?: string;
}) {
  const [status, setStatus] = React.useState<PreviewUiStatus>("idle");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [externalUrl, setExternalUrl] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [providerLevel, setProviderLevel] = React.useState<PreviewProviderLevel | undefined>();
  const [reloadKey, setReloadKey] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState("100%");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const iframeSrc = inAppPreviewSrc(sessionId, externalUrl);
  const shareUrl = safeShareUrl(sessionId, externalUrl ?? previewUrl ?? null);

  const syncFromStatus = React.useCallback(
    (data: {
      status?: string;
      preview_url?: string | null;
      external_url?: string | null;
      provider_level?: string;
      logs?: Array<{ message: string }>;
      error?: string | null;
    }) => {
      if (data.external_url) setExternalUrl(data.external_url);
      if (data.provider_level) setProviderLevel(data.provider_level as PreviewProviderLevel);
      if (data.logs) setLogs(data.logs.map((l) => l.message));
      if (data.error) setErrorMessage(data.error);
      if (data.status === "ready") setStatus("ready");
      if (data.status === "failed") setStatus("failed");
    },
    [],
  );

  const pollStatus = React.useCallback(
    async (sid: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/preview/status?sessionId=${sid}&poll=1`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      syncFromStatus(data);
    },
    [projectId, syncFromStatus],
  );

  const fetchLogs = React.useCallback(
    async (sid: string) => {
      const res = await fetch(`/api/projects/${projectId}/preview/logs?sessionId=${sid}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { logs?: Array<{ message: string }>; error?: string };
      setLogs((data.logs ?? []).map((l) => l.message));
      if (data.error) setErrorMessage(data.error);
    },
    [projectId],
  );

  const startPreview = React.useCallback(async () => {
    if (!hasGenerated && !isImported) return;
    setStatus("starting");
    setLogs([]);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        sessionId?: string;
        previewUrl?: string;
        externalUrl?: string | null;
        providerLevel?: PreviewProviderLevel;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setStatus("failed");
        setErrorMessage(data.error ?? "Preview failed to start");
        setLogs([data.error ?? "Preview failed to start"]);
        if (data.sessionId) {
          setSessionId(data.sessionId);
          void fetchLogs(data.sessionId);
        }
        return;
      }
      setSessionId(data.sessionId ?? null);
      setExternalUrl(data.externalUrl ?? null);
      setProviderLevel(data.providerLevel);
      setStatus("ready");
      if (data.sessionId) {
        void fetchLogs(data.sessionId);
        void pollStatus(data.sessionId);
      }
    } catch (e) {
      setStatus("failed");
      setErrorMessage(String(e));
      setLogs([String(e)]);
    }
  }, [projectId, hasGenerated, fetchLogs, pollStatus]);

  React.useEffect(() => {
    if (autoStart && hasGenerated && status === "idle") void startPreview();
  }, [autoStart, hasGenerated, status, startPreview]);

  React.useEffect(() => {
    if (!sessionId || status !== "ready") return;
    const t = window.setInterval(() => void pollStatus(sessionId), 8000);
    return () => window.clearInterval(t);
  }, [sessionId, status, pollStatus]);

  const reloadPreview = () => {
    setReloadKey((k) => k + 1);
    if (sessionId) void pollStatus(sessionId);
  };

  return (
    <div className={cn("flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl ring-1 ring-border", className)}>
      <PreviewToolbar
        previewUrl={shareUrl}
        loading={status === "starting"}
        providerLabel={
          providerLevel ? (PREVIEW_LEVEL_LABELS[providerLevel] ?? providerLevel) : undefined
        }
        onRefresh={() => {
          reloadPreview();
        }}
        onReloadIframe={() => setReloadKey((k) => k + 1)}
        onViewportChange={setViewportWidth}
      />
      <div className="relative min-h-0 flex-1 bg-atmosphere">
        {iframeSrc && status === "ready" ? (
          <div className="mx-auto h-full p-2" style={{ maxWidth: viewportWidth }}>
            <iframe
              key={reloadKey}
              title="Preview"
              src={iframeSrc}
              className="h-full min-h-[360px] w-full rounded-lg border border-border bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            {externalUrl?.startsWith("http") && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                Open hosted preview
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            {status === "starting" ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                Starting preview…
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!hasGenerated && !isImported}
                  onClick={() => void startPreview()}
                  className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {hasGenerated || isImported ? "Start preview" : "Generate app first"}
                </button>
                {!hasGenerated && !isImported && (
                  <p className="text-[11px] text-muted-foreground">Preview is blocked until the app is generated.</p>
                )}
                {isImported && !hasGenerated && (
                  <p className="text-[11px] text-muted-foreground">
                    Imported app detected — start preview when setup is complete.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <PreviewStatusPanel
        projectId={projectId}
        status={status}
        logs={logs}
        previewUrl={shareUrl}
        providerLevel={providerLevel}
        lifecycleStatus={lifecycleStatus}
        errorMessage={errorMessage}
        onRetry={() => void startPreview()}
        className="m-2 mt-0"
      />
    </div>
  );
}
