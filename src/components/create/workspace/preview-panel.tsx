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
import {
  isVirtualPreviewRuntimePath,
  stripPreviewCacheBustFromUrl,
} from "@/lib/preview/internal-preview-url";
import { analyzeIframeEmbeddabilityFromHeaders } from "@/lib/preview/preview-iframe-embed-headers";
import {
  previewIframeDomKey,
  type PreviewIframeUrlResolution,
} from "@/lib/preview/preview-iframe-url-resolver";
import { navigatePreviewIframe } from "@/lib/preview/preview-route-navigation";
import { isPreviewAuthSystemRoute } from "@/lib/preview/preview-auth-routes";
import { withPreviewRuntimeLoginPath } from "@/lib/preview/preview-runtime-login-url";
import {
  isPreviewInnerRouteErrorMessage,
  type PreviewInnerRouteErrorMessage,
} from "@/lib/preview/preview-inner-route-types";
import { PreviewInnerRouteErrorPanel } from "@/components/preview/preview-inner-route-error-panel";
import { PreviewUniversalErrorPanel } from "@/components/preview/preview-universal-error-panel";
import { PreviewDebugDrawer } from "@/components/preview/preview-debug-drawer";
import { PreviewLiveDiagnosticBar } from "@/components/preview/preview-live-diagnostic-bar";
import { createPreviewLiveDiagnostics } from "@/lib/preview/preview-live-diagnostics";
import { resolvePreviewState } from "@/lib/preview/resolve-preview-state";
import {
  isIgnorablePreviewAssetLoadFailure,
  isPreviewBootAuditMessage,
  previewBootSucceeded,
  summarizeBootAudit,
  type PreviewBootAuditPayload,
  type PreviewBootAuditSummary,
} from "@/lib/preview/preview-boot-audit-types";
import type { PreviewIncidentPromptInput } from "@/lib/preview/build-preview-incident-prompt";
import { PreviewBootFailurePanel } from "@/components/preview/preview-boot-failure-panel";
import { postPreviewIframeDeepClean } from "@/lib/preview/post-preview-iframe-deep-clean";
import { extractArtifactIdFromRuntimeUrl } from "@/lib/preview/preview-external-asset-rewrite";
import { refreshCredits } from "@/lib/stores/credits-store";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<Viewport, { width: string; label: string; icon: React.ElementType }> = {
  desktop: { width: "w-full max-w-[1480px]", label: "Desktop (1480)", icon: Monitor },
  tablet: { width: "w-[768px] max-w-full", label: "iPad (768)", icon: Tablet },
  mobile: { width: "w-[390px] max-w-full", label: "iPhone 15 (390)", icon: Smartphone },
};

const DEVICE_FRAME: Record<
  Exclude<Viewport, "desktop">,
  { width: number; height: number; radius: string; bezel: number }
> = {
  mobile: { width: 390, height: 844, radius: "2.75rem", bezel: 10 },
  tablet: { width: 768, height: 1024, radius: "1.25rem", bezel: 8 },
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
  isBusy?: boolean;
  isImportedZip?: boolean;
  /** Live published URL (subdomain) — external open only when set. */
  publishedPublicUrl?: string | null;
  isPublished?: boolean;
  previewShellVariant?: "default" | "github";
  githubConnected?: boolean;
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
  isBusy = false,
  isImportedZip = false,
  publishedPublicUrl = null,
  isPublished = false,
  previewShellVariant = "default",
  githubConnected = false,
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
  const [bootAuditEvents, setBootAuditEvents] = React.useState<PreviewBootAuditPayload[]>([]);
  const [iframeMountCount, setIframeMountCount] = React.useState(0);
  const [bootFailureDismissed, setBootFailureDismissed] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const lastNavigatedRouteRef = React.useRef<string | null>(null);
  const lastMountSrcRef = React.useRef<string | null>(null);
  const stableArtifactIdRef = React.useRef<string | null>(null);
  const lockedIframeSrcRef = React.useRef<string | null>(null);
  const [overlayVisible, setOverlayVisible] = React.useState(false);
  const liveDiagnosticsRef = React.useRef(createPreviewLiveDiagnostics());
  const [liveDiagSnapshot, setLiveDiagSnapshot] = React.useState(
    () => liveDiagnosticsRef.current.snapshot(),
  );
  const [previewLoadingMs, setPreviewLoadingMs] = React.useState(0);

  React.useEffect(() => {
    lockedIframeSrcRef.current = null;
    stableArtifactIdRef.current = null;
    lastMountSrcRef.current = null;
    lastNavigatedRouteRef.current = null;
    liveDiagnosticsRef.current.reset();
    setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
  }, [projectId, reloadKey]);

  React.useEffect(() => {
    const detach = liveDiagnosticsRef.current.attachWindow();
    return detach;
  }, []);

  React.useEffect(() => {
    if (!loadingStartedAt || iframeLoaded) {
      setPreviewLoadingMs(0);
      return;
    }
    const tick = window.setInterval(() => {
      setPreviewLoadingMs(Date.now() - loadingStartedAt);
    }, 250);
    return () => window.clearInterval(tick);
  }, [loadingStartedAt, iframeLoaded]);

  const effectivePreviewPath = urlResolution?.normalizedPreviewUrl ?? url;

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

  const candidateMountSrc = React.useMemo(() => {
    if (!resolvedPreviewUrl) return null;
    return stripPreviewCacheBustFromUrl(resolvedPreviewUrl);
  }, [resolvedPreviewUrl]);

  const runtimeArtifactId =
    urlResolution?.artifactId ??
    stableArtifactIdRef.current ??
    extractArtifactIdFromRuntimeUrl(candidateMountSrc) ??
    extractArtifactIdFromRuntimeUrl(url);

  if (candidateMountSrc) {
    const isPreviewPath =
      candidateMountSrc.includes("/preview-runtime/") ||
      candidateMountSrc.includes("/preview-html");
    const runtimePathReady =
      !candidateMountSrc.includes("/preview-runtime/") ||
      Boolean(runtimeArtifactId && candidateMountSrc.includes(runtimeArtifactId));

    if (isPreviewPath && runtimePathReady && !lockedIframeSrcRef.current) {
      lockedIframeSrcRef.current = candidateMountSrc;
    }
  }

  const lockedMountSrc = lockedIframeSrcRef.current;

  const activeIframeSrc = React.useMemo(() => {
    const base = lockedMountSrc;
    if (!base) return null;
    const route = previewRoute ?? urlResolution?.route ?? "/";
    if (!isPreviewAuthSystemRoute(route)) return base;
    try {
      const u = new URL(
        base,
        typeof window !== "undefined" ? window.location.origin : "https://vodex.dev",
      );
      u.searchParams.set("route", route);
      return u.href;
    } catch {
      return base;
    }
  }, [lockedMountSrc, previewRoute, urlResolution?.route]);

  if (!stableArtifactIdRef.current) {
    stableArtifactIdRef.current =
      urlResolution?.artifactId ??
      extractArtifactIdFromRuntimeUrl(lockedMountSrc) ??
      extractArtifactIdFromRuntimeUrl(candidateMountSrc) ??
      null;
  }

  const iframeReloadKey = React.useMemo(
    () =>
      previewIframeDomKey({
        projectId: projectId ?? "unknown",
        artifactId: "mount",
        reloadKey,
      }),
    [projectId, reloadKey],
  );

  const artifactPreviewReady = Boolean(
    stableArtifactIdRef.current &&
      (runtimeStatus?.previewRenderable === true || runtimeStatus?.jobStatus === "succeeded"),
  );

  const overlayMaxMs = artifactPreviewReady ? 0 : 1000;

  // Route changes navigate inside the iframe — iframe src stays on preview root.

  React.useEffect(() => {
    const mountKey = hasInline ? `inline:${reloadKey}` : activeIframeSrc;
    if (!mountKey) {
      setOverlayVisible(false);
      setIframeLoading(false);
      setLoadingStartedAt(null);
      return;
    }
    if (lastMountSrcRef.current === mountKey) {
      if (overlayMaxMs <= 0 || iframeLoaded) {
        setOverlayVisible(false);
        setIframeLoading(false);
      }
      return;
    }
    lastMountSrcRef.current = mountKey;

    setIframeError(false);
    setInnerRouteError(null);
    setLoadingExceeded60s(false);
    setIframeLoaded(false);
    setLoadingStartedAt(Date.now());

    if (overlayMaxMs <= 0) {
      setOverlayVisible(false);
      setIframeLoading(false);
      return;
    }

    setIframeLoading(true);
    const t = window.setTimeout(() => {
      setOverlayVisible(false);
      setIframeLoading(false);
    }, overlayMaxMs);
    return () => window.clearTimeout(t);
  }, [activeIframeSrc, hasInline, reloadKey, overlayMaxMs, iframeLoaded]);

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

  React.useEffect(() => {
    if (hasInline || !activeIframeSrc) {
      setIframeHeaderProbe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        let res = await fetch(activeIframeSrc, { method: "HEAD", credentials: "include" });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(activeIframeSrc, {
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
  }, [activeIframeSrc, hasInline, reloadKey]);

  React.useEffect(() => {
    setBootAuditEvents([]);
    setBootFailureDismissed(false);
  }, [projectId, urlResolution?.artifactId, reloadKey]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isPreviewBootAuditMessage(event.data)) return;
      const frameWin = iframeRef.current?.contentWindow;
      if (frameWin && event.source !== frameWin) return;
      setBootAuditEvents((prev) => [...prev.slice(-80), event.data]);
      const phase = event.data.phase;
      if (phase === "asset-error") {
        const failedUrl = event.data.failedAssetUrl ?? "";
        if (
          !isIgnorablePreviewAssetLoadFailure(failedUrl, event.data.failedAssetTag ?? null)
        ) {
          liveDiagnosticsRef.current.push({
            kind: "boot",
            level: "error",
            message: String(failedUrl || phase),
            detail: phase,
          });
          setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
        }
      } else if (phase === "runtime-error") {
        liveDiagnosticsRef.current.push({
          kind: "boot",
          level: "error",
          message: String(event.data.errorMessage ?? phase),
          detail: event.data.errorStack ? String(event.data.errorStack).slice(0, 320) : phase,
        });
        setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
      } else if (
        phase === "auth-stuck" ||
        phase === "auth-redirect" ||
        phase === "base44-ui-detected"
      ) {
        liveDiagnosticsRef.current.push({
          kind: "auth",
          level: phase === "auth-redirect" ? "info" : "warn",
          message: String(
            event.data.base44UiReason ??
              event.data.authStuckReason ??
              event.data.navigationUrl ??
              phase,
          ),
          detail: typeof event.data.bodySnippet === "string" ? event.data.bodySnippet : undefined,
          rootCause:
            typeof event.data.suggestedFix === "string"
              ? event.data.suggestedFix
              : "Google/Base44 OAuth blocked in iframe — Vodex login page required at preview-runtime/.../login",
        });
        setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
        if ((phase === "auth-stuck" || phase === "base44-ui-detected") && activeIframeSrc) {
          try {
            const loginUrl = withPreviewRuntimeLoginPath(activeIframeSrc);
            if (iframeRef.current && iframeRef.current.src !== loginUrl) {
              iframeRef.current.src = loginUrl;
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (phase === "ready" || phase === "snapshot") {
        liveDiagnosticsRef.current.push({ kind: "boot", level: "info", message: "Preview boot ready" });
        setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
        setOverlayVisible(false);
        setIframeLoading(false);
        setIframeLoaded(true);
        setIframeError(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeIframeSrc]);

  React.useEffect(() => {
    const onRoute = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null;
      if (!data || data.type !== "vodex-preview-route") return;
      const frameWin = iframeRef.current?.contentWindow;
      if (frameWin && event.source !== frameWin) return;
      const path = typeof data.path === "string" ? data.path : "/";
      onPreviewRouteChange?.(path);
    };
    window.addEventListener("message", onRoute);
    return () => window.removeEventListener("message", onRoute);
  }, [onPreviewRouteChange]);

  React.useEffect(() => {
    if (!iframeLoaded || !activeIframeSrc || hasInline) return;
    const loginUrl = withPreviewRuntimeLoginPath(activeIframeSrc);
    const tick = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        const text = (doc?.body?.innerText ?? "").toLowerCase();
        if (!text.includes("opening secure google") && !text.includes("connecting you securely")) return;
        let authed = false;
        try {
          authed = iframeRef.current?.contentWindow?.localStorage?.getItem("sb-preview-auth") === "1";
        } catch {
          /* ignore */
        }
        if (authed) return;
        const frame = iframeRef.current;
        if (frame && frame.src !== loginUrl) {
          liveDiagnosticsRef.current.push({
            kind: "auth",
            level: "warn",
            message: "Detected stuck Google sign-in — redirecting to Vodex login",
            rootCause: "OAuth popup/redirect cannot complete inside preview iframe",
          });
          setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
          frame.src = loginUrl;
        }
      } catch {
        /* same-origin only */
      }
    };
    const id = window.setInterval(tick, 900);
    tick();
    return () => window.clearInterval(id);
  }, [iframeLoaded, activeIframeSrc, hasInline]);

  const creditsChargedRef = React.useRef(false);
  React.useEffect(() => {
    if (!runtimeStatus?.creditsCharged || creditsChargedRef.current) return;
    creditsChargedRef.current = true;
    void refreshCredits({ reason: "charge", force: true });
  }, [runtimeStatus?.creditsCharged, runtimeStatus?.chargedActionCredits]);

  const bootAuditSummary = React.useMemo(
    () => summarizeBootAudit(bootAuditEvents, { iframeRemountCount: iframeMountCount }),
    [bootAuditEvents, iframeMountCount],
  );

  React.useEffect(() => {
    setIframeMountCount((c) => c + 1);
  }, [iframeReloadKey]);

  React.useEffect(() => {
    if (!iframeLoaded || hasInline || !activeIframeSrc) return;
    const route = previewRoute ?? urlResolution?.route ?? "/";
    if (isPreviewAuthSystemRoute(route)) return;
    if (lastNavigatedRouteRef.current === route) return;
    lastNavigatedRouteRef.current = route;
    navigatePreviewIframe(iframeRef.current, route);
  }, [previewRoute, urlResolution?.route, iframeLoaded, hasInline, activeIframeSrc]);

  React.useEffect(() => {
    if (!overlayVisible || hasInline || !activeIframeSrc) return;
    const checkReady = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc?.readyState === "complete") {
          setOverlayVisible(false);
          setIframeLoading(false);
          setIframeLoaded(true);
          setIframeError(false);
        }
      } catch {
        /* same-origin only */
      }
    };
    checkReady();
    const interval = window.setInterval(checkReady, 200);
    return () => window.clearInterval(interval);
  }, [overlayVisible, activeIframeSrc, hasInline]);

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
  const internalPreviewMount = Boolean(
    isInternalPreviewProxyUrl(effectivePreviewPath) ||
      isInternalPreviewProxyUrl(url) ||
      (resolvedPreviewUrl ? isInternalPreviewProxyUrl(resolvedPreviewUrl) : false),
  );
  const embedBlocked = Boolean(
    !internalPreviewMount &&
      (effectivePreviewPath || url) &&
      !hasInline &&
      (!artifactUrlOk || rawBlocked || headerBlocksEmbed),
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
        iframeLoading: artifactPreviewReady ? false : iframeLoading,
        loadingExceeded60s: artifactPreviewReady ? false : loadingExceeded60s,
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
      artifactPreviewReady,
    ],
  );

  const previewBootHealthy = React.useMemo(
    () => previewBootSucceeded(bootAuditEvents, { iframeRemountCount: iframeMountCount }),
    [bootAuditEvents, iframeMountCount],
  );

  const previewIncidentInput = React.useMemo((): Omit<
    PreviewIncidentPromptInput,
    "liveSnapshot"
  > => ({
    projectId: projectId ?? null,
    artifactId: urlResolution?.artifactId ?? runtimeArtifactId ?? null,
    previewRoute: previewRoute ?? urlResolution?.route ?? null,
    iframeUrl: resolvedPreviewUrl ?? null,
    canonicalState: canonicalPreview.state,
    embedBlocked,
    embedBlockReason,
    iframeMountCount,
    bootAudit: bootAuditSummary,
    bootEvents: bootAuditEvents,
    urlResolution: urlResolution ?? null,
    runtimePreviewRenderable: runtimeStatus?.previewRenderable ?? null,
    jobStatus: runtimeStatus?.jobStatus ?? null,
  }), [
    projectId,
    urlResolution,
    runtimeArtifactId,
    previewRoute,
    resolvedPreviewUrl,
    canonicalPreview.state,
    embedBlocked,
    embedBlockReason,
    iframeMountCount,
    bootAuditSummary,
    bootAuditEvents,
    runtimeStatus,
  ]);

  const forcePreviewSurface =
    artifactPreviewReady && Boolean(lockedMountSrc ?? activeIframeSrc);
  const showBuildShell = canonicalPreview.showBuildingShell && !forcePreviewSurface;
  const showArtifact = hasPreviewArtifact && !showBuildShell;
  const showRuntimeOverlay = showArtifact && canonicalPreview.showRuntimeOverlay;
  const showEmbedFallback = showArtifact && embedBlocked && !hasInline && !canonicalPreview.showErrorPanel;
  const showIframeSurface =
    showArtifact && canonicalPreview.showIframe && !showEmbedFallback && !showRuntimeOverlay;
  const iframeMountEligible = hasInline
    ? showArtifact && hasInline
    : Boolean(lockedMountSrc && hasPreviewArtifact && !embedBlocked);

  React.useEffect(() => {
    if (embedBlocked) {
      liveDiagnosticsRef.current.push({
        kind: "state",
        level: "error",
        message: embedBlockReason,
      });
      setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
    }
  }, [embedBlocked, embedBlockReason]);

  React.useEffect(() => {
    if (!loadingStartedAt || iframeLoaded || !showIframeSurface) return;
    const t = window.setTimeout(() => {
      liveDiagnosticsRef.current.push({
        kind: "state",
        level: "warn",
        message: "Preview iframe load exceeded 12s — check boot errors or blocked assets",
      });
      setLiveDiagSnapshot(liveDiagnosticsRef.current.snapshot());
      setOverlayVisible(false);
      setIframeLoading(false);
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [loadingStartedAt, iframeLoaded, showIframeSurface, activeIframeSrc, reloadKey]);

  const generationContinuing = canonicalPreview.showGenerationContinuingCopy;
  const showInnerRouteError = Boolean(innerRouteError && showArtifact && !embedBlocked);
  const showUniversalError =
    canonicalPreview.showErrorPanel &&
    !showBuildShell &&
    !showInnerRouteError &&
    !showEmbedFallback &&
    canonicalPreview.state !== "inner_route_error";
  const showBootFailure =
    !bootFailureDismissed &&
    !previewBootHealthy &&
    canonicalPreview.state === "ready" &&
    showIframeSurface &&
    Boolean(bootAuditSummary.bootFailureReason) &&
    !overlayVisible &&
    (bootAuditEvents.some(
      (e) =>
        e.phase === "runtime-error" ||
        (e.phase === "asset-error" &&
          e.failedAssetUrl &&
          !isIgnorablePreviewAssetLoadFailure(e.failedAssetUrl, e.failedAssetTag ?? null)),
    ) ||
      (bootAuditSummary.loadedCount < 3 &&
        bootAuditEvents.filter((e) => e.phase === "snapshot").length >= 2));

  React.useEffect(() => {
    const shouldLog =
      showPreviewDebug ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "development");
    if (!shouldLog) return;
    console.info("[preview-render-gate]", {
      canonicalState: canonicalPreview.state,
      sourceOfTruth: canonicalPreview.sourceOfTruth,
      showIframe: showIframeSurface,
      iframeMountEligible,
      showBuildShell,
      showRuntimeOverlay,
      showUniversalError,
      generationContinuing,
      previewRenderable: canonicalPreview.previewRenderable,
      runtimePreviewRenderable: runtimeStatus?.previewRenderable ?? null,
      workerStatus: runtimeStatus?.jobStatus ?? null,
      artifactId: canonicalPreview.artifactId,
      iframeUrl: resolvedPreviewUrl,
      thinking,
      buildActive,
      isBusy,
      projectFilesCount: projectFileCount,
      importFileCount: canonicalPreview.raw.importFileCount,
      isImportedZip,
      iframeMountCount,
      bootFailureReason: bootAuditSummary.bootFailureReason,
    });
  }, [
    showPreviewDebug,
    canonicalPreview,
    showIframeSurface,
    iframeMountEligible,
    showBuildShell,
    showRuntimeOverlay,
    showUniversalError,
    generationContinuing,
    runtimeStatus,
    resolvedPreviewUrl,
    thinking,
    buildActive,
    isBusy,
    projectFileCount,
    isImportedZip,
    iframeMountCount,
    bootAuditSummary.bootFailureReason,
  ]);

  const showSlowLoadHint =
    showArtifact &&
    iframeError &&
    !embedBlocked &&
    !previewPreparing &&
    !previewBuildFailed &&
    !hasInline &&
    !showInnerRouteError &&
    !showUniversalError &&
    !showBootFailure &&
    canonicalPreview.state === "ready";
  const shellState =
    buildActive || thinking
      ? previewState === "compiling"
        ? "compiling"
        : "building"
      : "idle";
  const livePublicUrl =
    isPublished && publishedPublicUrl?.trim() ? publishedPublicUrl.trim() : null;

  const displayHost = hasInline
    ? "live preview (generated)"
    : livePublicUrl
      ? (() => {
          try {
            return new URL(livePublicUrl).host;
          } catch {
            return livePublicUrl;
          }
        })()
      : hasPreviewArtifact && url
        ? (() => {
            try {
              return new URL(url).host;
            } catch {
              return url;
            }
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
            {(hasPreviewArtifact && overlayVisible) && (
              <Wifi className="size-3 shrink-0 animate-pulse text-accent/60" strokeWidth={1.75} />
            )}
            {(hasPreviewArtifact && !overlayVisible && !iframeError && iframeRenderable) && (
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
              postPreviewIframeDeepClean(iframeRef.current, { reload: false });
              onClearPreviewCache();
              setReloadKey((k) => k + 1);
              setIframeError(false);
              setIframeLoading(true);
              toast.success("Preview cache cleared — deep clean + reload");
            }}
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-border transition hover:bg-surface hover:text-foreground"
          >
            Clear cache
          </button>
        ) : null}

        {/* Open live published app — blocked until first publish */}
        {hasPreviewArtifact && (
          livePublicUrl ? (
            <a
              href={livePublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open live app"
              title="Open published app"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
            >
              <ExternalLink className="size-3" strokeWidth={1.7} />
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-label="Publish to open live app"
              title="Publish your app first to open the live subdomain"
              className="flex size-6 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
            >
              <ExternalLink className="size-3" strokeWidth={1.7} />
            </button>
          )
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
            variant={githubConnected ? previewShellVariant : "default"}
            githubPhase={artifactPreviewReady ? "success" : "fetching"}
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
                {livePublicUrl ? (
                  <a
                    href={livePublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Open live app
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

        {showBootFailure && bootAuditSummary.bootFailureReason ? (
          <div className="absolute inset-0 z-25 flex items-center justify-center bg-atmosphere/95 p-6 backdrop-blur-sm">
            <PreviewBootFailurePanel
              summary={bootAuditSummary}
              iframeUrl={resolvedPreviewUrl}
              incidentInput={previewIncidentInput}
              bootEvents={bootAuditEvents}
              onRetryLoad={() => {
                setBootFailureDismissed(false);
                setBootAuditEvents([]);
                setIframeError(false);
                setIframeLoading(true);
                setReloadKey((k) => k + 1);
              }}
              onDismiss={() => setBootFailureDismissed(true)}
            />
          </div>
        ) : null}

        {iframeMountEligible && (
          <div
            className={cn(
              "absolute inset-0 overflow-hidden",
              !showIframeSurface && "pointer-events-none invisible",
              viewport !== "desktop" && "flex items-center justify-center bg-[#0a0a0b] p-4",
            )}
            data-testid="preview-fit-canvas"
          >
              <div
                className={cn(
                  "relative flex flex-col overflow-hidden",
                  viewport === "desktop" &&
                    "absolute inset-x-0 top-2 bottom-1 mx-auto h-[calc(100%-12px)] w-[min(100%,102%)] rounded-sm bg-white shadow-[0_2px_24px_-6px_rgba(0,0,0,0.12)] ring-1 ring-border/50",
                  viewport === "tablet" &&
                    "max-h-full max-w-full shadow-[0_12px_48px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10",
                  viewport === "mobile" &&
                    "max-h-full max-w-full shadow-[0_16px_56px_-8px_rgba(0,0,0,0.65)] ring-1 ring-white/10",
                )}
                style={
                  viewport !== "desktop"
                    ? {
                        width: `min(${DEVICE_FRAME[viewport].width}px, calc(100% - 1rem))`,
                        height: `min(${DEVICE_FRAME[viewport].height}px, calc(100% - 1rem))`,
                        aspectRatio: `${DEVICE_FRAME[viewport].width} / ${DEVICE_FRAME[viewport].height}`,
                        borderRadius: DEVICE_FRAME[viewport].radius,
                        background: "#111113",
                        padding: DEVICE_FRAME[viewport].bezel,
                      }
                    : undefined
                }
              >
                {viewport === "mobile" && (
                  <div
                    className="pointer-events-none relative z-20 flex shrink-0 items-end justify-center"
                    style={{ height: 28, marginBottom: -2 }}
                  >
                    <div className="h-[22px] w-[120px] rounded-full bg-black" />
                  </div>
                )}

                {viewport === "tablet" && (
                  <div className="pointer-events-none relative z-20 flex h-2 shrink-0 items-center justify-center">
                    <div className="size-1.5 rounded-full bg-zinc-700" />
                  </div>
                )}

                <div
                  className={cn(
                    "relative min-h-0 flex-1 overflow-hidden bg-white",
                    viewport === "mobile" && "rounded-[2rem]",
                    viewport === "tablet" && "rounded-lg",
                    viewport === "desktop" && "h-full w-full",
                  )}
                >
                {showIframeSurface && overlayVisible && !iframeLoaded ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-5 animate-spin text-accent" strokeWidth={1.75} />
                      <span className="text-[11px] text-muted-foreground">Loading preview…</span>
                    </div>
                  </div>
                ) : null}

                <iframe
                    key={iframeReloadKey}
                    ref={iframeRef}
                    src={hasInline ? undefined : activeIframeSrc ?? undefined}
                    srcDoc={hasInline ? (srcDoc ?? undefined) : undefined}
                    title={appName ?? "App preview"}
                    className="h-full w-full flex-1 border-0"
                    onLoad={() => {
                      setOverlayVisible(false);
                      setIframeLoading(false);
                      setIframeLoaded(true);
                      setIframeError(false);
                    }}
                    onError={() => {
                      setIframeError(true);
                      setOverlayVisible(false);
                      setIframeLoading(false);
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
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

        <PreviewLiveDiagnosticBar
          snapshot={liveDiagSnapshot}
          iframeUrl={resolvedPreviewUrl}
          canonicalState={canonicalPreview.state}
          loadingMs={iframeLoaded ? 0 : previewLoadingMs}
          incidentInput={previewIncidentInput}
        />

        <PreviewDebugDrawer
          resolved={canonicalPreview}
          urlResolution={urlResolution}
          iframeHeaderProbe={iframeHeaderProbe?.headers ?? null}
          bootAudit={bootAuditSummary}
          iframeUrl={resolvedPreviewUrl}
          iframeMountCount={iframeMountCount}
          visible={showPreviewDebug}
        />

        {previewDiagnostics ? (
          <div
            data-testid="preview-diagnostics"
            data-preview-source={previewDiagnostics.source}
            data-preview-route={previewDiagnostics.selected_route}
            data-preview-artifact={previewDiagnostics.artifactId ?? ""}
            data-preview-was-normalized={previewDiagnostics.wasNormalized ? "true" : "false"}
            data-preview-was-rejected={previewDiagnostics.wasRejected ? "true" : "false"}
            className="sr-only"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
