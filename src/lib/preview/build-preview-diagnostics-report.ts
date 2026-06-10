import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { downloadPreviewArtifactFile, PREVIEW_ARTIFACTS_BUCKET } from "@/lib/imports/preview-artifact-storage";
import { rewritePreviewArtifactHtml } from "@/lib/preview/rewrite-preview-artifact-html";
import {
  buildInternalPreviewHtmlUrl,
  buildVirtualPreviewRuntimeUrl,
} from "@/lib/preview/internal-preview-url";
import {
  analyzeIframeEmbeddabilityFromHeaders,
  detectPreviewIframeUrlMode,
  mergePreviewIframeEmbedHeaders,
  scanHtmlForIframeBlockingMeta,
  type PreviewIframeUrlMode,
} from "@/lib/preview/preview-iframe-embed-headers";
import { innerRouteBootstrapLikelyBroken } from "@/lib/preview/detect-inner-route-bootstrap";
import {
  countHydrationPathLeaks,
  scanBootstrapLeaksDetailed,
  stripPlatformInjectionScripts,
} from "@/lib/preview/preview-bootstrap-sanitizer";
import { TEXT_ARTIFACT_EXT } from "@/lib/preview/preview-path-leak-scanner";
import { scanPreviewArtifactLeaks } from "@/lib/preview/scan-preview-artifact-leaks";
import {
  PREVIEW_TEXT_ASSET_EXT,
  sanitizeServedPreviewAssetText,
} from "@/lib/preview/serve-preview-artifact-asset";

export type PreviewDiagnosticsReport = {
  project_id: string;
  preview_url: string | null;
  artifact_id: string | null;
  artifact_path: string | null;
  latest_worker_job: string | null;
  latest_worker_status: string | null;
  preview_renderable: boolean;
  service_worker_detected: boolean;
  next_data_detected: boolean;
  next_f_detected: boolean;
  flight_payload_detected: boolean;
  router_cache_detected: boolean;
  unsafe_path_count: number;
  hydration_path_count: number;
  boot_asset_leak_count: number;
  failed_asset_count: number;
  visible_next_404_detected: boolean;
  bad_inner_route_visible: boolean;
  rendered_document_error_detected: boolean;
  current_iframe_url: string | null;
  iframe_embeddable: boolean;
  iframe_block_reason: string | null;
  iframe_response_headers: Record<string, string | null>;
  iframe_url_mode: PreviewIframeUrlMode | null;
  rebuild_required: boolean;
  served_html_bytes: number | null;
  stored_unsafe_path_count: number | null;
  first_leaking_asset: string | null;
  issues: string[];
};

async function listArtifactFiles(
  admin: SupabaseClient,
  artifactPath: string,
): Promise<string[]> {
  const out: string[] = [];
  async function walk(folder: string) {
    const { data, error } = await admin.storage.from(PREVIEW_ARTIFACTS_BUCKET).list(folder, {
      limit: 500,
    });
    if (error || !data) return;
    for (const ent of data) {
      const rel = folder ? `${folder}/${ent.name}` : ent.name;
      if (ent.id == null) await walk(rel);
      else out.push(rel.replace(`${artifactPath}/`, "").replace(/^\/+/, ""));
    }
  }
  await walk(artifactPath);
  return out;
}

function artifactIdFromPath(artifactPath: string | null, projectId: string): string | null {
  if (!artifactPath) return null;
  const parts = artifactPath.split("/").filter(Boolean);
  if (parts[0] === projectId && parts[1]) return parts[1];
  return parts[parts.length - 1] ?? null;
}

function detectVisibleNext404(html: string): boolean {
  const appHtml = stripPlatformInjectionScripts(html);
  const lower = appHtml.toLowerCase();
  const has404 =
    lower.includes("page not found") ||
    lower.includes("could not be found in this application") ||
    lower.includes("could not be found");
  if (!has404) return false;
  return /preview-html|preview-runtime\/[a-f0-9-]+\/[a-f0-9-]+|api\/projects\/[a-f0-9-]+\/preview-html/i.test(appHtml);
}

function detectBadInnerRouteVisible(html: string): boolean {
  const appHtml = stripPlatformInjectionScripts(html);
  return (
    (/api\/projects\/[a-f0-9-]+\/preview-html/i.test(appHtml) ||
      /preview-runtime\/[a-f0-9-]+\/[a-f0-9-]+/i.test(appHtml)) &&
    /page not found/i.test(appHtml)
  );
}

function scanServedHtmlSignals(html: string, projectId: string) {
  const service_worker_detected = /navigator\.serviceWorker\.register\s*\(/i.test(html);
  const next_data_detected = /<script[^>]+id="__NEXT_DATA__"/i.test(html);
  const next_f_detected = /__next_f/i.test(html);
  const flight_payload_detected = /__next_f\.push\s*\(/i.test(html);
  const router_cache_detected =
    /"initialTree"[^[]*\[[^\]]*preview-html/i.test(html) ||
    /"pathname"\s*:\s*"[^"]*preview-html/i.test(html) ||
    /"asPath"\s*:\s*"[^"]*preview-html/i.test(html);

  const unsafeMatches = scanBootstrapLeaksDetailed(html, projectId, {
    excludePlatformInjections: true,
  });
  const hydration_path_count = countHydrationPathLeaks(html, projectId, true);

  return {
    service_worker_detected,
    next_data_detected,
    next_f_detected,
    flight_payload_detected,
    router_cache_detected,
    unsafe_path_count: unsafeMatches.length,
    hydration_path_count,
  };
}

async function probePreviewIframeEmbeddability(input: {
  iframeUrl: string | null;
  servedHtml: string;
  baseOrigin: string;
}): Promise<{
  iframe_embeddable: boolean;
  iframe_block_reason: string | null;
  iframe_response_headers: Record<string, string | null>;
  iframe_url_mode: PreviewIframeUrlMode | null;
}> {
  const iframe_url_mode = detectPreviewIframeUrlMode(input.iframeUrl);
  const expected = analyzeIframeEmbeddabilityFromHeaders(mergePreviewIframeEmbedHeaders());

  if (!input.iframeUrl) {
    return {
      iframe_embeddable: false,
      iframe_block_reason: "No preview iframe URL",
      iframe_response_headers: expected.iframe_response_headers,
      iframe_url_mode: null,
    };
  }

  const metaScan = scanHtmlForIframeBlockingMeta(input.servedHtml);
  if (metaScan.blocked) {
    return {
      iframe_embeddable: false,
      iframe_block_reason: metaScan.reason,
      iframe_response_headers: expected.iframe_response_headers,
      iframe_url_mode,
    };
  }

  const absoluteUrl = input.iframeUrl.startsWith("http")
    ? input.iframeUrl
    : new URL(input.iframeUrl, input.baseOrigin).href;

  try {
    let res = await fetch(absoluteUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(absoluteUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        headers: { Range: "bytes=0-0" },
      });
    }
    const live = analyzeIframeEmbeddabilityFromHeaders(res.headers);
    if (!live.iframe_embeddable) {
      return { ...live, iframe_url_mode };
    }
    return { ...live, iframe_url_mode };
  } catch {
    return { ...expected, iframe_url_mode };
  }
}

export async function buildPreviewDiagnosticsReport(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PreviewDiagnosticsReport | null> {
  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata, preview_url, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!proj) return null;

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const admin = createSupabaseAdmin();

  type PreviewJobRow = {
    id: string;
    status: string;
    artifact_path: string | null;
    preview_renderable: boolean | null;
  };
  let jobRow: PreviewJobRow | null = null;
  if (admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_build_jobs")
      .select("id, status, artifact_path, preview_renderable")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobRow = (data as PreviewJobRow | null) ?? null;
  }

  const previewRenderable =
    meta.preview_renderable === true ||
    jobRow?.preview_renderable === true ||
    meta.preview_ready === true;

  const artifactPath =
    (typeof meta.preview_artifact_path === "string" ? meta.preview_artifact_path : null) ??
    jobRow?.artifact_path ??
    null;
  const artifactId = artifactIdFromPath(artifactPath, projectId);

  let servedHtml = "";
  let storedUnsafeTotal = 0;
  let bootAssetLeakCount = 0;
  let firstLeakingAsset: string | null = null;
  const issues: string[] = [];

  if (admin && artifactPath) {
    const index = await downloadPreviewArtifactFile({
      admin,
      artifactPath,
      relativePath: "index.html",
    });
    if (index) {
      const buildId = artifactId ?? "unknown";
      servedHtml = rewritePreviewArtifactHtml(index.data.toString("utf8"), projectId, buildId, "/");
    } else {
      issues.push("artifact index.html missing from storage");
    }

    try {
      const leakReport = await scanPreviewArtifactLeaks(admin, projectId);
      if (leakReport) {
        bootAssetLeakCount = leakReport.served_leak_count;
        const first = leakReport.hits.find((h) => h.phase === "served");
        firstLeakingAsset = first?.file ?? null;
        storedUnsafeTotal = leakReport.stored_leak_count;
      } else {
        const files = await listArtifactFiles(admin, artifactPath);
        for (const rel of files) {
          if (!TEXT_ARTIFACT_EXT.test(rel) && !PREVIEW_TEXT_ASSET_EXT.test(rel)) continue;
          const file = await downloadPreviewArtifactFile({ admin, artifactPath, relativePath: rel });
          if (!file) continue;
          const raw = file.data.toString("utf8");
          const served =
            /index\.html?$/i.test(rel) && artifactId
              ? rewritePreviewArtifactHtml(raw, projectId, artifactId, "/")
              : sanitizeServedPreviewAssetText(raw, projectId, "/");
          const servedLeaks = scanBootstrapLeaksDetailed(served, projectId, {
            excludePlatformInjections: true,
            file: rel,
          }).filter((l) => !l.safe);
          bootAssetLeakCount += servedLeaks.length;
          if (!firstLeakingAsset && servedLeaks.length > 0) firstLeakingAsset = rel;
          storedUnsafeTotal += scanBootstrapLeaksDetailed(raw, projectId, {
            excludePlatformInjections: false,
            file: rel,
          }).filter((l) => !l.safe).length;
        }
      }
    } catch (e) {
      issues.push(`artifact scan failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (!artifactPath) {
    issues.push("no preview artifact path");
  }

  const visibleNext404 = servedHtml ? detectVisibleNext404(servedHtml) : false;
  const badInnerRouteVisible = servedHtml ? detectBadInnerRouteVisible(servedHtml) : false;
  const renderedDocumentError =
    visibleNext404 || badInnerRouteVisible || innerRouteBootstrapLikelyBroken(servedHtml, projectId);

  const servedSignals = servedHtml ? scanServedHtmlSignals(servedHtml, projectId) : {
    service_worker_detected: false,
    next_data_detected: false,
    next_f_detected: false,
    flight_payload_detected: false,
    router_cache_detected: false,
    unsafe_path_count: 0,
    hydration_path_count: 0,
  };

  if (servedHtml && innerRouteBootstrapLikelyBroken(servedHtml, projectId)) {
    issues.push("inner route bootstrap likely broken in served HTML");
  }
  if (bootAssetLeakCount > 0) {
    issues.push(
      `${bootAssetLeakCount} boot asset leak(s) in served text assets${firstLeakingAsset ? ` (first: ${firstLeakingAsset})` : ""}`,
    );
  }
  if (visibleNext404) {
    issues.push("visible Next 404 for stale preview-html route detected in served HTML simulation");
  }
  if (badInnerRouteVisible) {
    issues.push("bad inner route visible — imported app would render preview proxy 404");
  }
  if (storedUnsafeTotal > 0) {
    issues.push(`${storedUnsafeTotal} unsafe path leak(s) in stored artifact`);
  }
  if (jobRow?.status === "failed") {
    issues.push(`latest worker job failed: ${jobRow.id}`);
  }

  const rebuild_required =
    !previewRenderable ||
    storedUnsafeTotal > 0 ||
    bootAssetLeakCount > 0 ||
    servedSignals.unsafe_path_count > 0 ||
    visibleNext404 ||
    badInnerRouteVisible ||
    (servedHtml ? innerRouteBootstrapLikelyBroken(servedHtml, projectId) : false) ||
    jobRow?.status === "failed";

  const currentIframeUrl =
    artifactId && previewRenderable
      ? buildVirtualPreviewRuntimeUrl({
          projectId,
          artifactBuildId: artifactId,
          route: "/",
          cacheBust: jobRow?.id ?? undefined,
        })
      : previewRenderable
        ? buildInternalPreviewHtmlUrl({
            projectId,
            route: "/",
            cacheBust: jobRow?.id ?? undefined,
          })
        : null;

  const baseOrigin =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    "http://localhost:3000";

  const iframeProbe = await probePreviewIframeEmbeddability({
    iframeUrl: currentIframeUrl,
    servedHtml,
    baseOrigin,
  });

  if (!iframeProbe.iframe_embeddable && iframeProbe.iframe_block_reason) {
    issues.push(`iframe not embeddable: ${iframeProbe.iframe_block_reason}`);
  }

  return {
    project_id: projectId,
    preview_url: proj.preview_url ?? null,
    artifact_id: artifactId,
    artifact_path: artifactPath,
    latest_worker_job: jobRow?.id ?? null,
    latest_worker_status: jobRow?.status ?? null,
    preview_renderable: previewRenderable,
    ...servedSignals,
    boot_asset_leak_count: bootAssetLeakCount,
    failed_asset_count: 0,
    visible_next_404_detected: visibleNext404,
    bad_inner_route_visible: badInnerRouteVisible,
    rendered_document_error_detected: renderedDocumentError,
    current_iframe_url: currentIframeUrl,
    iframe_embeddable: iframeProbe.iframe_embeddable,
    iframe_block_reason: iframeProbe.iframe_block_reason,
    iframe_response_headers: iframeProbe.iframe_response_headers,
    iframe_url_mode: iframeProbe.iframe_url_mode,
    rebuild_required,
    served_html_bytes: servedHtml ? servedHtml.length : null,
    stored_unsafe_path_count: artifactPath ? storedUnsafeTotal : null,
    first_leaking_asset: firstLeakingAsset,
    issues,
  };
}
