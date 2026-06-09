"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  ExternalLink,
  Globe,
  ShieldAlert,
  Loader2,
  Wifi,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { BuildPreviewSurface } from "@/components/create/workspace/build-preview-surface";
import { PreviewEditOverlay } from "@/components/preview/preview-edit-overlay";
import { PreviewRuntimeStatusPanel } from "@/components/create/workspace/preview-runtime-status-panel";
import { PreviewPageSwitcher } from "@/components/create/workspace/preview-page-switcher";
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import type { PreviewRouteEntry } from "@/lib/preview/detect-preview-routes";
import type { ImportedPreviewStateResult } from "@/lib/preview/imported-preview-state";
import { ImportedPreviewEmptyState } from "@/components/preview/imported-preview-empty-state";
import {
  isBlockedRawAppPreviewUrl,
  isInternalPreviewProxyUrl,
  toPreviewIframeSrc,
  tryNormalizeInternalPreviewUrl,
} from "@/lib/preview/rewrite-preview-artifact-html";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<Viewport, { width: string; label: string; icon: React.ElementType }> = {
  desktop: { width: "w-full max-w-[1480px]", label: "Desktop (1480)", icon: Monitor },
  tablet: { width: "w-[820px] max-w-full", label: "Tablet (820)", icon: Tablet },
  mobile: { width: "w-[393px] max-w-full", label: "Phone (393)", icon: Smartphone },
};

export interface PreviewPanelProps {
  url: string | null;
  /** Inline HTML for generated previews (e.g. from `preview/index.html`). */
  srcDoc?: string | null;
  appName?: string | null;
  thinking?: boolean;
  className?: string;
  editMode?: boolean;
  /** Whether any generation has completed. Edit targeting only activates when true. */
  hasGenerated?: boolean;
  onEditTarget?: (info: { x: number; y: number; section: string; tag?: string }) => void;
  previewState?: "idle" | "building" | "compiling";
  buildStepIndex?: number;
  buildStepLabel?: string | null;
  tokensEstimate?: number | null;
  modelLabel?: string | null;
  /** When true, show the building shell instead of empty/unrenderable preview. */
  buildActive?: boolean;
  runtimeStatus?: PreviewRuntimeStatusPayload | null;
  previewRoutes?: PreviewRouteEntry[];
  previewRoute?: string;
  onPreviewRouteChange?: (path: string) => void;
  onRebuildPreview?: () => void;
  onStartPreview?: () => void;
  previewRebuilding?: boolean;
  previewStarting?: boolean;
  importedPreviewState?: ImportedPreviewStateResult | null;
  onPrepareImportedPreview?: () => void;
  onRepairPreview?: () => void;
  prepareImportBusy?: boolean;
  /** When false, never show preview loading — generation has not produced a previewable app yet. */
  canPreview?: boolean;
}

function isUnrenderableSrcDoc(doc: string | null | undefined): boolean {
  if (!doc?.trim()) return true;
  return /no renderable content/i.test(doc);
}

function isArtifactPreviewUrl(url: string | null): boolean {
  return isInternalPreviewProxyUrl(url);
}

export function PreviewPanel({
  url,
  srcDoc = null,
  appName,
  thinking = false,
  className,
  editMode = false,
  hasGenerated = false,
  onEditTarget,
  previewState = "idle",
  buildStepIndex = 0,
  buildStepLabel = null,
  tokensEstimate = null,
  modelLabel = null,
  buildActive = false,
  runtimeStatus = null,
  previewRoutes = [],
  previewRoute = "/",
  onPreviewRouteChange,
  onRebuildPreview,
  onStartPreview,
  previewRebuilding = false,
  previewStarting = false,
  importedPreviewState = null,
  onPrepareImportedPreview,
  onRepairPreview,
  prepareImportBusy = false,
  canPreview = true,
}: PreviewPanelProps) {
  const [viewport, setViewport] = React.useState<Viewport>("desktop");
  const [reloadKey, setReloadKey] = React.useState(0);
  const [iframeError, setIframeError] = React.useState(false);
  const [iframeLoading, setIframeLoading] = React.useState(false);
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Route changes reload iframe via previewFrameUrl ?route= query — no postMessage escape.

  React.useEffect(() => {
    setIframeError(false);
    setIframeLoaded(false);
    if (url || srcDoc) setIframeLoading(true);
  }, [url, srcDoc, reloadKey]);

  const hasInline = !!srcDoc?.trim() && !isUnrenderableSrcDoc(srcDoc);
  const resolvedPreviewUrl = React.useMemo(() => {
    if (!url || hasInline) return null;
    const normalized = tryNormalizeInternalPreviewUrl(url);
    if (!normalized) return null;
    try {
      return toPreviewIframeSrc(normalized);
    } catch {
      return null;
    }
  }, [url, hasInline]);
  const previewUrlInvalid = Boolean(url && !hasInline && !resolvedPreviewUrl);
  const iframeRenderable = runtimeStatus?.previewRenderable === true;
  const previewBuildFailed =
    runtimeStatus?.jobStatus === "failed" || runtimeStatus?.previewStatus === "failed";
  const previewPreparing = Boolean(runtimeStatus && !iframeRenderable && !previewBuildFailed);
  const isArtifactUrl = Boolean(url && isArtifactPreviewUrl(url));

  React.useEffect(() => {
    if (!iframeLoading) return;
    if (previewPreparing) return;
    const timeoutMs = isArtifactUrl ? 120_000 : 45_000;
    const t = window.setTimeout(() => {
      setIframeLoading(false);
      setIframeError(true);
    }, timeoutMs);
    return () => window.clearTimeout(t);
  }, [iframeLoading, reloadKey, url, srcDoc, previewPreparing, isArtifactUrl]);

  const rawBlocked = Boolean(url && isBlockedRawAppPreviewUrl(url)) || previewUrlInvalid;
  const previewDiagnostics = React.useMemo(() => {
    if (!url || hasInline) return null;
    const source = previewUrlInvalid
      ? "invalid_preview_url"
      : rawBlocked
        ? "raw_blocked"
        : isArtifactUrl
          ? "artifact_proxy"
          : "unknown";
    let artifactPath: string | null = null;
    try {
      const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://localhost");
      artifactPath = u.pathname;
    } catch {
      artifactPath = url;
    }
    const fallbackApplied = previewRoute !== "/" && isArtifactUrl;
    return {
      source,
      selected_route: previewRoute,
      artifact_path: artifactPath,
      fallback: fallbackApplied ? "index.html" : null,
      rawUrlBlocked: rawBlocked,
      fallback_applied: fallbackApplied,
    };
  }, [url, hasInline, rawBlocked, isArtifactUrl, previewRoute, previewUrlInvalid]);

  const hasPreviewArtifact = !!url || hasInline;
  const artifactUrlOk = hasInline || !url || (isArtifactUrl && !rawBlocked);
  const embedBlocked = Boolean(url && !hasInline && (!artifactUrlOk || rawBlocked));
  const showBuildShell = buildActive || thinking;
  const showArtifact = hasPreviewArtifact && !showBuildShell;
  const awaitingRuntimeStatus = Boolean(url && isArtifactUrl && !hasInline && !runtimeStatus);
  const showRuntimeOverlay =
    showArtifact &&
    !embedBlocked &&
    (awaitingRuntimeStatus ||
      (Boolean(runtimeStatus) && (!iframeRenderable || previewPreparing)));
  const showEmbedFallback = showArtifact && embedBlocked && !hasInline;
  const showIframe =
    showArtifact &&
    !showEmbedFallback &&
    !showRuntimeOverlay &&
    (hasInline || iframeRenderable);
  const generationContinuing = canPreview === false && !buildActive;
  const showSlowLoadHint =
    canPreview !== false &&
    showArtifact &&
    iframeError &&
    !embedBlocked &&
    !previewPreparing &&
    !previewBuildFailed &&
    !hasInline;
  const shellState =
    buildActive || thinking
      ? previewState === "compiling"
        ? "compiling"
        : "building"
      : "idle";
  const displayHost = hasInline
    ? "live preview (generated)"
    : hasPreviewArtifact && url
      ? (() => {
          try { return new URL(url).host; }
          catch { return url; }
        })()
      : "preview";

  return (
    <div
      data-testid="preview-panel"
      data-preview-srcdoc-ready={hasInline ? "true" : "false"}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-background ring-1 ring-border",
        className,
      )}
    >
      {/* Browser chrome topbar */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-surface/80 px-3.5 py-2 backdrop-blur">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
        </div>

        {previewRoutes.length > 0 && onPreviewRouteChange ? (
          <PreviewPageSwitcher
            routes={previewRoutes}
            currentPath={previewRoute}
            onSelect={onPreviewRouteChange}
            disabled={!hasPreviewArtifact}
          />
        ) : (
          <div className="flex flex-1 items-center gap-1.5 rounded-md bg-background/80 px-3 py-1.5 ring-1 ring-border/60">
            <Globe className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">
              {displayHost}
            </span>
            {(hasPreviewArtifact && iframeLoading) && (
              <Wifi className="size-3 shrink-0 animate-pulse text-accent/60" strokeWidth={1.75} />
            )}
            {(hasPreviewArtifact && !iframeLoading && !iframeError && iframeRenderable) && (
              <span className="size-1.5 shrink-0 rounded-full bg-green-400" />
            )}
          </div>
        )}

        {/* Viewport switch */}
        <div className="flex items-center gap-0.5 rounded-md bg-background p-0.5 ring-1 ring-border">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((vp) => {
            const { icon: Icon, label } = VIEWPORT_CONFIG[vp];
            return (
              <button
                key={vp}
                type="button"
                aria-label={`${label} preview`}
                aria-pressed={viewport === vp}
                onClick={() => setViewport(vp)}
                title={label}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[5px] transition",
                  viewport === vp
                    ? "bg-surface text-foreground shadow-[var(--shadow-xs)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.7} />
              </button>
            );
          })}
        </div>

        {/* Reload */}
        <button
          type="button"
          aria-label="Reload preview"
          disabled={!hasPreviewArtifact}
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className="size-3" strokeWidth={1.7} />
        </button>

        {/* Open in new tab */}
        {hasPreviewArtifact && (
          <a
            href={url!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in new tab"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
          >
            <ExternalLink className="size-3" strokeWidth={1.7} />
          </a>
        )}
      </div>

      {/* Viewport surface */}
      <div className="relative flex-1 overflow-hidden bg-atmosphere">
        {/* Edit mode: guard — only show targeting overlay after generation exists */}
        {editMode && !hasGenerated && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <Pencil className="size-5 text-amber-500" strokeWidth={1.75} />
              </div>
              <p className="text-[14px] font-semibold text-foreground">Nothing to edit yet</p>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-[260px]">
                Generate your first interface to begin surgical editing.
              </p>
              <p className="text-[11.5px] text-muted-foreground/60">
                Switch to <span className="font-semibold text-accent">Build</span> mode and describe your app.
              </p>
            </div>
          </div>
        )}

        {/* Edit mode targeting — scans real DOM inside preview iframe */}
        {editMode && hasGenerated && showArtifact && (
          <PreviewEditOverlay
            iframeRef={iframeRef}
            iframeLoaded={iframeLoaded}
            onSelect={({ section, tag }) =>
              onEditTarget?.({ x: 0, y: 0, section: `${section} (${tag})`, tag })
            }
          />
        )}

        {!showArtifact &&
        !showRuntimeOverlay &&
        importedPreviewState &&
        importedPreviewState.state !== "preview_ready" ? (
          <ImportedPreviewEmptyState
            classification={importedPreviewState}
            previewUrl={url}
            onPreparePreview={onPrepareImportedPreview}
            onRunRepair={onRepairPreview}
            preparing={prepareImportBusy}
          />
        ) : !showArtifact ? (
          <BuildPreviewSurface
            state={shellState}
            appName={appName}
            currentStep={
              generationContinuing
                ? "Preview not available yet — generation is still continuing."
                : buildStepLabel
            }
            stepIndex={buildStepIndex}
          />
        ) : null}

        {showRuntimeOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-atmosphere p-6">
            {runtimeStatus ? (
              <PreviewRuntimeStatusPanel
                status={runtimeStatus}
                onRebuild={onRebuildPreview}
                onStartPreview={onStartPreview}
                onRunRepair={onRepairPreview}
                rebuilding={previewRebuilding}
                startingPreview={previewStarting}
                className="max-w-lg w-full shadow-lg"
              />
            ) : (
              <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-background p-8 text-center shadow-lg ring-1 ring-border">
                <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.75} />
                <p className="text-[13px] font-semibold text-foreground">Preparing preview</p>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Loading preview status for your app…
                </p>
              </div>
            )}
          </div>
        )}

        {generationContinuing && !showBuildShell && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-atmosphere p-6">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-background p-8 text-center shadow-lg ring-1 ring-border">
              <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.75} />
              <p className="text-[13px] font-semibold text-foreground">
                Preview not available yet — generation is still continuing.
              </p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Continue generation from chat when the build pauses — preview opens once real app files are saved.
              </p>
            </div>
          </div>
        )}

        {showSlowLoadHint && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-atmosphere p-6">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-background p-8 text-center shadow-lg ring-1 ring-border">
              <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.75} />
              <p className="text-[13px] font-semibold text-foreground">Preview is still loading</p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Large imported apps can take a minute to compile. You can wait, open in a new tab, or run
                preview repair.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Open preview in new tab
                    <ExternalLink className="size-3.5" strokeWidth={2} />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIframeError(false);
                    setIframeLoading(true);
                    setReloadKey((k) => k + 1);
                  }}
                  className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                >
                  Retry load
                </button>
                {onRebuildPreview ? (
                  <button
                    type="button"
                    onClick={() => onRebuildPreview()}
                    disabled={previewRebuilding}
                    className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                  >
                    {previewRebuilding ? "Repairing…" : "Run preview repair"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {showEmbedFallback && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-atmosphere p-6">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-background p-8 text-center shadow-lg ring-1 ring-border">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
                <ShieldAlert className="size-5 text-destructive" strokeWidth={1.7} />
              </div>
              <p className="text-[13px] font-semibold text-foreground">
                {previewUrlInvalid
                  ? "Preview route URL invalid"
                  : rawBlocked
                    ? "External preview URL blocked"
                    : "Preview embed blocked"}
              </p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {previewUrlInvalid
                  ? "The preview iframe must load an absolute Vodex API route starting with /api/projects/…/preview-html — not a relative app path."
                  : rawBlocked
                    ? "Imported apps must load through the internal preview proxy — never raw vodex.dev URLs in the iframe."
                    : "This route blocks iframe embedding. Open the preview in a new tab or run embed repair."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {url ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                    >
                      Open preview in new tab
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(url).then(
                          () => toast.success("Copied preview URL"),
                          () => toast.error("Could not copy"),
                        );
                      }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                    >
                      Copy preview URL
                    </button>
                  </>
                ) : null}
                {onRebuildPreview ? (
                  <button
                    type="button"
                    onClick={() => onRebuildPreview()}
                    disabled={previewRebuilding}
                    className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                  >
                    {previewRebuilding ? "Repairing…" : "Run preview repair"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {showIframe && (
          <div
            className={cn(
              "absolute inset-0 overflow-hidden",
              viewport !== "desktop" && "flex items-center justify-center overflow-auto bg-black/85 p-3",
            )}
            data-testid="preview-fit-canvas"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${reloadKey}-${url ?? "inline"}`}
                initial={{ opacity: 0, scale: viewport === "desktop" ? 1 : 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: viewport === "desktop" ? 1 : 0.97 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative flex flex-col overflow-hidden bg-white",
                  viewport === "desktop" &&
                    "absolute inset-x-0 top-2 bottom-1 mx-auto h-[calc(100%-12px)] w-[min(100%,102%)] rounded-sm shadow-[0_2px_24px_-6px_rgba(0,0,0,0.12)] ring-1 ring-border/50",
                  viewport === "tablet" &&
                    "max-h-[min(88vh,1024px)] w-[min(820px,calc(100%-20px))] rounded-[var(--radius-lg)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-border",
                  viewport === "mobile" &&
                    "z-10 max-h-[min(86vh,852px)] w-[min(393px,calc(100%-20px))] rounded-[var(--radius-lg)] shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-border",
                )}
              >
                {viewport === "mobile" && (
                  <div className="absolute top-0 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-black/90" />
                )}

                {/* Loading overlay */}
                <AnimatePresence>
                  {iframeLoading && (
                    <motion.div
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-accent" strokeWidth={1.75} />
                        <span className="text-[11px] text-muted-foreground">Loading preview…</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <iframe
                    ref={iframeRef}
                    key={`${reloadKey}-${url ?? "inline"}`}
                    src={hasInline ? undefined : resolvedPreviewUrl ?? undefined}
                    srcDoc={hasInline ? (srcDoc ?? undefined) : undefined}
                    title={appName ?? "App preview"}
                    className="h-full w-full flex-1 border-0"
                    onLoad={() => {
                      setIframeLoading(false);
                      setIframeLoaded(true);
                      setIframeError(false);
                    }}
                    onError={() => {
                      setIframeError(true);
                      setIframeLoading(false);
                    }}
                    sandbox="allow-scripts allow-same-origin"
                  />
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* AI streaming overlay */}
        <AnimatePresence>
          {showArtifact && thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6"
            >
              <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-[11.5px] font-medium text-foreground shadow-lg ring-1 ring-border backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                Updating preview…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {previewDiagnostics && showIframe ? (
          <div
            data-testid="preview-diagnostics"
            data-preview-source={previewDiagnostics.source}
            data-preview-route={previewDiagnostics.selected_route}
            className="pointer-events-none absolute bottom-1 right-2 z-30 max-w-[min(100%,420px)] truncate rounded-md bg-background/85 px-2 py-0.5 text-[9px] font-mono text-muted-foreground/80 ring-1 ring-border/50 backdrop-blur-sm"
            title={`source=${previewDiagnostics.source} route=${previewDiagnostics.selected_route} path=${previewDiagnostics.artifact_path} fallback=${previewDiagnostics.fallback_applied}`}
          >
            {previewDiagnostics.source} · {previewDiagnostics.selected_route}
            {previewDiagnostics.fallback_applied ? " · spa_fallback" : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
