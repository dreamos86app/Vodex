/** postMessage payloads from preview boot audit script inside iframe. */

export type PreviewBootResourceEntry = {
  name: string;
  initiatorType: string;
  transferSize: number;
  duration: number;
  responseStatus?: number;
};

export type PreviewBootAuditPayload = {
  type: "vodex-preview-boot-audit";
  phase:
    | "snapshot"
    | "ready"
    | "asset-error"
    | "runtime-error"
    | "navigation"
    | "serviceworker"
    | "auth-stuck"
    | "auth-redirect"
    | "base44-ui-detected";
  authStuckReason?: string;
  base44UiReason?: string;
  suggestedFix?: string;
  bodySnippet?: string;
  resources?: PreviewBootResourceEntry[];
  failedAssetUrl?: string;
  failedAssetTag?: string;
  errorMessage?: string;
  errorStack?: string;
  navigationMethod?: string;
  navigationUrl?: string;
  serviceWorkerCount?: number;
  virtualPath?: string;
  iframeUrl?: string;
  at?: string;
};

export type PreviewBootAuditSummary = {
  loadedCount: number;
  failedCount: number;
  cancelledOrIncompleteCount: number;
  firstFailedAssetUrl: string | null;
  firstRuntimeError: string | null;
  serviceWorkerCount: number | null;
  navigations: Array<{ method: string; url: string }>;
  resources: PreviewBootResourceEntry[];
  bootFailureReason: string | null;
};

export function isPreviewBootAuditMessage(data: unknown): data is PreviewBootAuditPayload {
  if (!data || typeof data !== "object") return false;
  return (data as Record<string, unknown>).type === "vodex-preview-boot-audit";
}

/** Route roots and SPA shell links are not static asset failures in preview-runtime. */
export function isIgnorablePreviewAssetLoadFailure(
  url: string,
  tagName?: string | null,
): boolean {
  const raw = url.trim();
  if (!raw || raw === "#" || raw.startsWith("#")) return true;

  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      path = new URL(raw).pathname;
    } else {
      path = raw.split("?")[0]?.split("#")[0] ?? raw;
    }
  } catch {
    path = raw.split("?")[0] ?? raw;
  }

  if (path === "/" || path === "") return true;

  const tag = (tagName ?? "").toUpperCase();
  const hasStaticExt = /\.(js|mjs|cjs|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map|json)(\?|$)/i.test(
    path,
  );
  if (hasStaticExt) return false;

  // Bare app routes (/login, /dashboard) — link/preload noise, not bundle failures.
  if (/^\/[A-Za-z0-9_./-]*$/.test(path) && !path.includes(".")) {
    if (tag === "LINK" || tag === "A" || tag === "SCRIPT") return true;
  }

  return false;
}

/** True when iframe reported ready and enough bundles transferred — ignore remount noise. */
export function previewBootSucceeded(
  events: PreviewBootAuditPayload[],
  opts?: { iframeRemountCount?: number },
): boolean {
  const summary = summarizeBootAudit(events, opts);
  const sawReady = events.some((ev) => ev.phase === "ready");
  return (
    sawReady &&
    summary.loadedCount >= 3 &&
    summary.failedCount === 0 &&
    !summary.firstRuntimeError
  );
}

export function summarizeBootAudit(
  events: PreviewBootAuditPayload[],
  opts?: { iframeRemountCount?: number },
): PreviewBootAuditSummary {
  const resources: PreviewBootResourceEntry[] = [];
  const navigations: Array<{ method: string; url: string }> = [];
  let failedCount = 0;
  let firstFailedAssetUrl: string | null = null;
  let firstRuntimeError: string | null = null;
  let serviceWorkerCount: number | null = null;

  const sawReady = events.some((ev) => ev.phase === "ready");

  for (const ev of events) {
    if (ev.phase === "snapshot" && ev.resources) {
      resources.push(...ev.resources);
    }
    if (ev.phase === "asset-error" && ev.failedAssetUrl) {
      if (isIgnorablePreviewAssetLoadFailure(ev.failedAssetUrl, ev.failedAssetTag)) {
        continue;
      }
      failedCount += 1;
      firstFailedAssetUrl ??= ev.failedAssetUrl;
    }
    if (ev.phase === "runtime-error" && ev.errorMessage) {
      firstRuntimeError ??= ev.errorMessage;
    }
    if (ev.phase === "navigation" && ev.navigationMethod && ev.navigationUrl) {
      navigations.push({ method: ev.navigationMethod, url: ev.navigationUrl });
    }
    if (ev.phase === "serviceworker" && typeof ev.serviceWorkerCount === "number") {
      serviceWorkerCount = ev.serviceWorkerCount;
    }
  }

  const scriptResources = resources.filter(
    (r) => r.initiatorType === "script" || r.initiatorType === "link" || /\.(js|css|mjs)(\?|$)/i.test(r.name),
  );
  const loadedCount = scriptResources.filter((r) => r.transferSize > 0 || r.duration > 0).length;
  const cancelledOrIncompleteCount = scriptResources.filter(
    (r) => r.transferSize === 0 && r.duration === 0,
  ).length;

  const bootHealthy = sawReady && loadedCount >= 3 && failedCount === 0 && !firstRuntimeError;
  const remounts = opts?.iframeRemountCount ?? 0;
  const cancelledRatio =
    scriptResources.length > 0 ? cancelledOrIncompleteCount / scriptResources.length : 0;

  let bootFailureReason: string | null = null;
  if (firstRuntimeError) {
    bootFailureReason = `Script runtime error: ${firstRuntimeError}`;
  } else if (!bootHealthy) {
    if (
      firstFailedAssetUrl &&
      !isIgnorablePreviewAssetLoadFailure(firstFailedAssetUrl)
    ) {
      bootFailureReason = `Asset failed to load: ${firstFailedAssetUrl}`;
    } else if (remounts > 1 && cancelledOrIncompleteCount > 0 && loadedCount < 3) {
      bootFailureReason = "Assets cancelled — iframe remounted before boot completed";
    } else if (
      remounts > 1 &&
      cancelledRatio > 0.6 &&
      loadedCount < 3 &&
      !sawReady
    ) {
      bootFailureReason = "Assets cancelled — iframe remounted before boot completed";
    } else if (cancelledOrIncompleteCount > 0 && loadedCount === 0) {
      bootFailureReason = "Assets cancelled or loaded from wrong path";
    } else if (serviceWorkerCount != null && serviceWorkerCount > 0) {
      bootFailureReason = `Service worker interference (${serviceWorkerCount} registration(s))`;
    }
  }

  return {
    loadedCount,
    failedCount,
    cancelledOrIncompleteCount,
    firstFailedAssetUrl,
    firstRuntimeError,
    serviceWorkerCount,
    navigations,
    resources,
    bootFailureReason,
  };
}
