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
  Copy,
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
import { isVirtualPreviewRuntimePath } from "@/lib/preview/internal-preview-url";
import { analyzeIframeEmbeddabilityFromHeaders } from "@/lib/preview/preview-iframe-embed-headers";
import {
  previewIframeDomKey,
  type PreviewIframeUrlResolution,
} from "@/lib/preview/preview-iframe-url-resolver";
import {
  isPreviewInnerRouteErrorMessage,
  type PreviewInnerRouteErrorMessage,
} from "@/lib/preview/preview-inner-route-types";
import { PreviewInnerRouteErrorPanel } from "@/components/preview/preview-inner-route-error-panel";
import { PreviewUniversalErrorPanel } from "@/components/preview/preview-universal-error-panel";
import { PreviewDebugDrawer } from "@/components/preview/preview-debug-drawer";
import { resolvePreviewState } from "@/lib/preview/resolve-preview-state";

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
  /** Legacy build-truth gate — canonical preview state overrides UI for imported ZIP artifacts. */
  canPreview?: boolean;
  projectId?: string | null;
  projectMetadata?: unknown;
  projectPreviewUrl?: string | null;
  projectFileCount?: number;
  urlResolution?: PreviewIframeUrlResolution | null;
  onClearPreviewCache?: () => void;
  onInnerRouteRepair?: () => void;
  innerRouteRepairing?: boolean;
  onRepairPreviewState?: () => void;
  previewStateRepairing?: boolean;
  showPreviewDebug?: boolean;
  onRefreshRuntimeStatus?: () => void;
}

function isUnrenderableSrcDoc(doc: string | null | undefined): boolean {
  if (!doc?.trim()) return true;
  return /no renderable content/i.test(doc);
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
  projectId = null,
  projectMetadata = null,
  projectPreviewUrl = null,
  projectFileCount = 0,
  urlResolution = null,
  onClearPreviewCache,
  onInnerRouteRepair,
  innerRouteRepairing = false,
  onRepairPreviewState,
  previewStateRepairing = false,
  showPreviewDebug = false,
  onRefreshRuntimeStatus,
}: PreviewPanelProps) {
  const [viewport, setViewport] = React.useState<Viewport>("desktop");
  const [reloadKey, setReloadKey] = React.useState(0);
  const [iframeError, setIframeError] = React.useState(false);
  const [iframeLoading, setIframeLoading] = React.useState(false);
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const [innerRouteError, setInnerRouteError] =
    React.useState<PreviewInnerRouteErrorMessage | null>(null);
  const [iframeHeaderProbe, setIframeHeaderProbe] = React.useState<{
    embeddable: boolean;
    reason: string | null;
    headers: Record<string, string | null>;
  } | null>(null);
  const [loadingStartedAt, setLoadingStartedAt] = React.useState<number | null>(null);
  const [loadingExceeded60s, setLoadingExceeded60s] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const effectivePreviewPath = urlResolution?.normalizedPreviewUrl ?? url;

  // Route changes reload iframe via previewFrameUrl ?route= query — no postMessage escape.

  React.useEffect(() => {
    setIframeError(false);
    setIframeLoaded(false);
    setInnerRouteError(null);
    setLoadingExceeded60s(false);
    if (url || srcDoc) {
      setIframeLoading(true);
      setLoadingStartedAt(Date.now());
    } else {
      setLoadingStartedAt(null);
    }
  }, [url, srcDoc, reloadKey, previewRoute]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isPreviewInnerRouteErrorMessage(event.data)) return;
      const frameWin = iframeRef.current?.contentWindow;
      if (frameWin && event.source !== frameWin) return;
      if (!frameWin && event.origin !== window.location.origin) return;
      setInnerRouteError(event.data);
      setIframeLoading(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const hasInline = !!srcDoc?.trim() && !isUnrenderableSrcDoc(srcDoc);
  const resolvedPreviewUrl = React.useMemo(() => {
    if (hasInline) return null;
    if (urlResolution?.iframeSrc) {
      if (urlResolution.iframeSrc.includes("api/projects/") && !urlResolution.iframeSrc.includes("/api/projects/")) {
        console.error("[preview-panel] refused traced relative iframe src", urlResolution);
        return null;
      }
      return urlResolution.iframeSrc;
    }
    if (!url) return null;
    if (isVirtualPreviewRuntimePath(url) || url.includes("/preview-runtime/")) {
      try {
        return toPreviewIframeSrc(url.startsWith("/") ? url : `/${url.replace(/^\/+/, "")}`);
      } catch {
        return null;
      }
    }
    if (url.startsWith("api/projects/") && !url.startsWith("/api/projects/")) {
      console.warn("[preview-panel] correcting relative preview iframe path before render", { url, source: "url_prop" });
    }
    const normalized = tryNormalizeInternalPreviewUrl(url);
    if (!normalized) return null;
    try {
      const src = toPreviewIframeSrc(normalized);
      if (src.includes("api/projects/") && !src.includes("/api/projects/")) {
        console.error("[preview-panel] refused relative api/projects iframe src", { src, source: "url_prop" });
        return null;
      }
      return src;
    } catch {
      return null;
    }
  }, [url, hasInline, urlResolution]);

  React.useEffect(() => {
    if (hasInline || !resolvedPreviewUrl) {
      setIframeHeaderProbe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        let res = await fetch(resolvedPreviewUrl, { method: "HEAD", credentials: "include" });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(resolvedPreviewUrl, {
            method: "GET",
            credentials: "include",
            headers: { Range: "bytes=0-0" },
          });
        }
        if (cancelled) return;
        const analysis = analyzeIframeEmbeddabilityFromHeaders(res.headers);
        setIframeHeaderProbe({
          embeddable: analysis.iframe_embeddable,
          reason: analysis.iframe_block_reason,
          headers: analysis.iframe_response_headers,
        });
      } catch {
        if (!cancelled) setIframeHeaderProbe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedPreviewUrl, hasInline, reloadKey]);

  const iframeDomKey = React.useMemo(
    () =>
      previewIframeDomKey({
        projectId: projectId ?? "unknown",
        artifactId: urlResolution?.artifactId ?? null,
        route: urlResolution?.route ?? previewRoute,
        normalizedSrc: urlResolution?.normalizedPreviewUrl ?? url,
        cacheBust: urlResolution?.cacheBust ?? reloadKey,
        reloadKey,
      }),
    [projectId, urlResolution, previewRoute, url, reloadKey],
  );

  const previewUrlInvalid = Boolean(
    (effectivePreviewPath || urlResolution?.selectedPreviewUrl) && !hasInline && !resolvedPreviewUrl,
  );
  const iframeRenderable = runtimeStatus?.previewRenderable === true;
  const previewBuildFailed =
    runtimeStatus?.jobStatus === "failed" || runtimeStatus?.previewStatus === "failed";
  const previewPreparing = Boolean(runtimeStatus && !iframeRenderable && !previewBuildFailed);
  const isArtifactUrl = Boolean(
    effectivePreviewPath && isInternalPreviewProxyUrl(effectivePreviewPath),
  );

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

  const rawBlocked =
    Boolean(
      effectivePreviewPath &&
        !isInternalPreviewProxyUrl(effectivePreviewPath) &&
        isBlockedRawAppPreviewUrl(effectivePreviewPath),
    ) || previewUrlInvalid;
  const previewDiagnostics = React.useMemo(() => {
    if (hasInline) return null;
    const activeUrl = urlResolution?.normalizedPreviewUrl ?? url;
    if (!activeUrl && !urlResolution) return null;
    const source = urlResolution?.source ?? (previewUrlInvalid
      ? "invalid_preview_url"
      : rawBlocked
        ? "raw_blocked"
        : isArtifactUrl
          ? "artifact_proxy"
          : "unknown");
    let artifactPath: string | null = null;
    try {
      const u = new URL(
        activeUrl ?? "",
        typeof window !== "undefined" ? window.location.origin : "https://localhost",
      );
      artifactPath = u.pathname;
    } catch {
      artifactPath = activeUrl;
    }
    const fallbackApplied = previewRoute !== "/" && isArtifactUrl;
    return {
      source,
      selectedPreviewUrl: urlResolution?.selectedPreviewUrl ?? url,
      normalizedPreviewUrl: urlResolution?.normalizedPreviewUrl ?? activeUrl,
      iframeSrc: resolvedPreviewUrl,
      artifactId: urlResolution?.artifactId ?? null,
      selected_route: urlResolution?.route ?? previewRoute,
      artifact_path: artifactPath,
      wasNormalized: urlResolution?.wasNormalized ?? false,
      wasRejected: urlResolution?.wasRejected ?? previewUrlInvalid,
      rejectReason: urlResolution?.rejectReason ?? null,
      fallback: fallbackApplied ? "index.html" : null,
      rawUrlBlocked: rawBlocked,
      fallback_applied: fallbackApplied,
      candidates: urlResolution?.candidates ?? [],
    };
  }, [
    url,
    hasInline,
    rawBlocked,
    isArtifactUrl,
    previewRoute,
    previewUrlInvalid,
    urlResolution,
    resolvedPreviewUrl,
  ]);

  const hasPreviewArtifact = Boolean(effectivePreviewPath || url || hasInline);
  const headerBlocksEmbed = iframeHeaderProbe?.embeddable === false;
  const artifactUrlOk =
    hasInline ||
    !effectivePreviewPath ||
    ((isArtifactUrl || Boolean(resolvedPreviewUrl)) && !rawBlocked && !headerBlocksEmbed);
  const embedBlocked = Boolean(
    (effectivePreviewPath || url) && !hasInline && (!artifactUrlOk || rawBlocked || headerBlocksEmbed),
  );
  const embedBlockReason =
    previewUrlInvalid
      ? "Preview route URL invalid — iframe src could not be resolved"
      : rawBlocked
        ? "External preview URL blocked — use internal preview proxy"
        : headerBlocksEmbed
          ? iframeHeaderProbe?.reason ?? "Response headers block iframe embedding"
          : !isArtifactUrl && effectivePreviewPath
            ? "This route blocks iframe embedding"
            : "Preview embed blocked";

  React.useEffect(() => {
    if (!iframeLoading || !loadingStartedAt) return;
    const t = window.setTimeout(() => {
      setLoadingExceeded60s(true);
      onRefreshRuntimeStatus?.();
    }, 60_000);
    return () => window.clearTimeout(t);
  }, [iframeLoading, loadingStartedAt, onRefreshRuntimeStatus]);

  const canonicalPreview = React.useMemo(
    () =>
      resolvePreviewState({
        projectId,
        projectMetadata,
        projectPreviewUrl,
        projectFileCount,
        framework: runtimeStatus?.framework ?? null,
        runtimeStatus,
        urlResolution,
        iframeUrl: effectivePreviewPath,
        iframeSrc: resolvedPreviewUrl,
        buildActive,
        thinking,
        hasInline,
        embedBlocked,
        embedBlockReason,
        previewUrlInvalid,
        innerRouteError: Boolean(innerRouteError),
        iframeError,
        iframeLoading,
        loadingExceeded60s,
        iframeEmbeddable: iframeHeaderProbe?.embeddable ?? null,
        iframeBlockReason: iframeHeaderProbe?.reason ?? null,
        legacyCanPreview: canPreview,
      }),
    [
      projectId,
      projectMetadata,
      projectPreviewUrl,
      projectFileCount,
      runtimeStatus,
      urlResolution,
      effectivePreviewPath,
      resolvedPreviewUrl,
      buildActive,
      thinking,
      hasInline,
      embedBlocked,
      embedBlockReason,
      previewUrlInvalid,
      innerRouteError,
      iframeError,
      iframeLoading,
      loadingExceeded60s,
      iframeHeaderProbe,
      canPreview,
    ],
  );

  const showBuildShell = canonicalPreview.showBuildingShell;
  const showArtifact = hasPreviewArtifact && !showBuildShell;
  const showRuntimeOverlay = showArtifact && canonicalPreview.showRuntimeOverlay;
  const showEmbedFallback = showArtifact && embedBlocked && !hasInline && !canonicalPreview.showErrorPanel;
  const showIframe = showArtifact && canonicalPreview.showIframe && !showEmbedFallback && !showRuntimeOverlay;
  const generationContinuing = canonicalPreview.showGenerationContinuingCopy;
  const showInnerRouteError = Boolean(innerRouteError && showArtifact && !embedBlocked);
  const showUniversalError =
    canonicalPreview.showErrorPanel &&
    !showBuildShell &&
    !showInnerRouteError &&
    !showEmbedFallback &&
    canonicalPreview.state !== "inner_route_error";
  const showSlowLoadHint =
    showArtifact &&
    iframeError &&
    !embedBlocked &&
    !previewPreparing &&
    !previewBuildFailed &&
    !hasInline &&
    !showInnerRouteError &&
    !showUniversalError &&
    canonicalPreview.state === "ready";
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
      data-preview-canonical-state={canonicalPreview.state}
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

        <button
          type="button"
          aria-label="Reload preview"
          disabled={!hasPreviewArtifact}
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className="size-3" strokeWidth={1.7} />
        </button>

        {onClearPreviewCache ? (
          <button
            type="button"
            aria-label="Clear preview cache"
            onClick={() => {
              onClearPreviewCache();
              setReloadKey((k) => k + 1);
              setIframeError(false);
              setIframeLoading(true);
              toast.success("Preview cache cleared — reloading canonical URL");
            }}
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-border transition hover:bg-surface hover:text-foreground"
          >
            Clear cache
          </button>
        ) : null}

        {/* Open in new tab */}
        {hasPreviewArtifact && (resolvedPreviewUrl ?? url) && (
          <a
            href={resolvedPreviewUrl ?? url!}
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
            <PreviewUniversalErrorPanel
              resolved={canonicalPreview}
              iframeUrl={resolvedPreviewUrl}
              onRetryLoad={() => {
                setIframeError(false);
                setIframeLoading(true);
                setReloadKey((k) => k + 1);
              }}
              onClearCache={onClearPreviewCache}
              onRebuildPreview={onRebuildPreview}
              onRunRepair={onRepairPreview}
              onRepairPreviewState={onRepairPreviewState}
              rebuilding={previewRebuilding}
              repairing={previewRebuilding}
              stateRepairing={previewStateRepairing}
            />
          </div>
        )}

        {showUniversalError && (
          <div className="absolute inset-0 z-25 flex items-center justify-center bg-atmosphere/95 p-6 backdrop-blur-sm">
            <PreviewUniversalErrorPanel
              resolved={canonicalPreview}
              iframeUrl={resolvedPreviewUrl}
              onRetryLoad={() => {
                setIframeError(false);
                setIframeLoading(true);
                setLoadingExceeded60s(false);
                setReloadKey((k) => k + 1);
              }}
              onClearCache={onClearPreviewCache}
              onRebuildPreview={onRebuildPreview}
              onRunRepair={onRepairPreview}
              onRepairPreviewState={onRepairPreviewState}
              rebuilding={previewRebuilding}
              repairing={previewRebuilding}
              stateRepairing={previewStateRepairing}
            />
          </div>
        )}

        {showInnerRouteError && innerRouteError ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-atmosphere/95 p-6 backdrop-blur-sm">
            <PreviewInnerRouteErrorPanel
              error={innerRouteError}
              iframeUrl={resolvedPreviewUrl}
              artifactId={urlResolution?.artifactId ?? previewDiagnostics?.artifactId ?? null}
              route={urlResolution?.route ?? previewRoute}
              runtimeStatus={runtimeStatus}
              onInnerRouteRepair={
                onInnerRouteRepair
                  ? () => {
                      setInnerRouteError(null);
                      onInnerRouteRepair();
                    }
                  : undefined
              }
              onClearPreviewCache={
                onClearPreviewCache
                  ? () => {
                      setInnerRouteError(null);
                      onClearPreviewCache();
                      setReloadKey((k) => k + 1);
                      setIframeLoading(true);
                    }
                  : undefined
              }
              onRebuildArtifact={
                onRebuildPreview
                  ? () => {
                      setInnerRouteError(null);
                      onRebuildPreview();
                    }
                  : undefined
              }
              innerRouteRepairing={innerRouteRepairing}
              previewRebuilding={previewRebuilding}
            />
          </div>
        ) : null}

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
                    : headerBlocksEmbed || !isArtifactUrl
                      ? embedBlockReason
                      : "Preview embed blocked"}
              </p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {previewUrlInvalid
                  ? "The preview iframe must load an absolute Vodex preview route (/preview-runtime/… or /api/projects/…/preview-html)."
                  : rawBlocked
                    ? "Imported apps must load through the internal preview proxy — never raw vodex.dev URLs in the iframe."
                    : embedBlockReason}
              </p>
              {resolvedPreviewUrl ? (
                <p
                  className="max-w-full truncate text-[10px] font-mono text-muted-foreground/80"
                  title={resolvedPreviewUrl}
                >
                  iframe URL: {resolvedPreviewUrl}
                </p>
              ) : effectivePreviewPath ? (
                <p
                  className="max-w-full truncate text-[10px] font-mono text-muted-foreground/80"
                  title={effectivePreviewPath}
                >
                  preview path: {effectivePreviewPath}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-center gap-2">
                {(resolvedPreviewUrl ?? effectivePreviewPath ?? url) ? (
                  <>
                    <a
                      href={resolvedPreviewUrl ?? effectivePreviewPath ?? url!}
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
                        const copyUrl = resolvedPreviewUrl ?? effectivePreviewPath ?? url ?? "";
                        void navigator.clipboard.writeText(copyUrl).then(
                          () => toast.success("Copied preview URL"),
                          () => toast.error("Could not copy"),
                        );
                      }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                    >
                      Copy preview URL
                    </button>
                    {iframeHeaderProbe?.headers ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(JSON.stringify(iframeHeaderProbe.headers, null, 2))
                            .then(
                              () => toast.success("Copied response headers"),
                              () => toast.error("Could not copy"),
                            );
                        }}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
                      >
                        <Copy className="size-3" strokeWidth={1.75} />
                        Copy headers
                      </button>
                    ) : null}
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
                key={iframeDomKey}
                initial={{ opacity: 0, scale: viewport === "desktop" ? 1 : 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: viewport === "desktop" ? 1 : 0.97 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative flex flex-col overflow-hidden bg-white",
                  viewport === "desktop" &&
                    "absolute inset-x-0 top-2 bottom-1 mx-auto h-[calc(100%-12px)] w-[min(100%,102%)] rounded-sm shadow-[0_2px_24px_-6px_rgba(0,0,0,0.12)] ring-1 ring-border/50",
                  viewport === "tablet" &&
                    "h-[min(88vh,1024px)] w-[min(820px,calc(100%-24px))] max-w-full rounded-[var(--radius-lg)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-border",
                  viewport === "mobile" &&
                    "z-10 h-[min(86vh,852px)] w-[min(393px,calc(100%-24px))] max-w-full rounded-[var(--radius-lg)] shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-border",
                )}
              >
                {viewport === "mobile" && (
                  <div className="pointer-events-none absolute top-0 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-b-lg bg-black/80" />
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
                    key={iframeDomKey}
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

        <PreviewDebugDrawer
          resolved={canonicalPreview}
          urlResolution={urlResolution}
          iframeHeaderProbe={iframeHeaderProbe?.headers ?? null}
          visible={showPreviewDebug}
        />

        {previewDiagnostics && (showIframe || previewUrlInvalid) ? (
          <div
            data-testid="preview-diagnostics"
            data-preview-source={previewDiagnostics.source}
            data-preview-route={previewDiagnostics.selected_route}
            data-preview-artifact={previewDiagnostics.artifactId ?? ""}
            data-preview-was-normalized={previewDiagnostics.wasNormalized ? "true" : "false"}
            data-preview-was-rejected={previewDiagnostics.wasRejected ? "true" : "false"}
            className="absolute bottom-1 left-2 right-2 z-30 rounded-lg bg-background/92 px-2.5 py-1.5 text-[9px] font-mono text-muted-foreground ring-1 ring-accent/20 backdrop-blur-sm"
          >
            <p className="truncate">
              <span className="font-semibold text-foreground">{previewDiagnostics.source}</span>
              {" · "}
              route={previewDiagnostics.selected_route}
              {previewDiagnostics.artifactId ? ` · artifact=${previewDiagnostics.artifactId.slice(0, 8)}…` : ""}
              {previewDiagnostics.wasNormalized ? " · normalized" : ""}
              {previewDiagnostics.wasRejected ? ` · rejected:${previewDiagnostics.rejectReason}` : ""}
            </p>
            <p className="truncate opacity-80" title={previewDiagnostics.iframeSrc ?? undefined}>
              iframe: {previewDiagnostics.iframeSrc ?? "—"}
              {iframeHeaderProbe?.reason ? ` · ${iframeHeaderProbe.reason}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
