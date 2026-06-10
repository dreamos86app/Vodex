import {
  buildInternalPreviewHtmlUrl,
  normalizeInternalPreviewUrl,
  toPreviewIframeSrc,
  tryNormalizeInternalPreviewUrl,
} from "@/lib/preview/internal-preview-url";
import { isBlockedRawAppPreviewUrl } from "@/lib/preview/rewrite-preview-artifact-html";

export type PreviewUrlSource =
  | "project.preview_url"
  | "runtime.previewUrl"
  | "previewRuntime.previewUrl"
  | "app_card.preview_url"
  | "generated_fallback"
  | "local_state"
  | "route_switcher"
  | "rebuilt_canonical";

export type PreviewUrlCandidate = {
  source: PreviewUrlSource;
  url: string | null | undefined;
};

export type PreviewIframeUrlResolution = {
  selectedPreviewUrl: string | null;
  normalizedPreviewUrl: string | null;
  iframeSrc: string | null;
  source: PreviewUrlSource | "rejected" | "none";
  artifactId: string | null;
  route: string;
  cacheBust: string | number | null;
  wasNormalized: boolean;
  wasRejected: boolean;
  rejectReason: string | null;
  candidates: Array<{
    source: PreviewUrlSource;
    raw: string | null;
    normalized: string | null;
    rejected: boolean;
    rejectReason: string | null;
  }>;
};

const SOURCE_PRIORITY: PreviewUrlSource[] = [
  "previewRuntime.previewUrl",
  "runtime.previewUrl",
  "project.preview_url",
  "local_state",
  "app_card.preview_url",
  "route_switcher",
  "generated_fallback",
];

export function isRelativeApiProjectsPath(url: string): boolean {
  return url.includes("api/projects/") && !url.includes("/api/projects/");
}

export function extractArtifactIdFromPreviewUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url, "https://preview.local");
    return parsed.searchParams.get("artifact");
  } catch {
    const m = /[?&]artifact=([^&]+)/.exec(url);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  }
}

function evaluateCandidate(
  source: PreviewUrlSource,
  raw: string | null | undefined,
): PreviewIframeUrlResolution["candidates"][number] {
  const trimmed = raw?.trim() ?? null;
  if (!trimmed) {
    return { source, raw: null, normalized: null, rejected: true, rejectReason: "empty" };
  }
  if (isBlockedRawAppPreviewUrl(trimmed)) {
    return { source, raw: trimmed, normalized: null, rejected: true, rejectReason: "blocked_raw_vodex_url" };
  }
  if (isRelativeApiProjectsPath(trimmed)) {
    const fixed = trimmed.startsWith("api/projects/") ? `/${trimmed}` : trimmed;
    const normalized = tryNormalizeInternalPreviewUrl(fixed);
    return {
      source,
      raw: trimmed,
      normalized,
      rejected: !normalized,
      rejectReason: normalized ? "normalized_relative_api_projects" : "relative_api_projects_unfixable",
    };
  }
  const normalized = tryNormalizeInternalPreviewUrl(trimmed);
  return {
    source,
    raw: trimmed,
    normalized,
    rejected: !normalized,
    rejectReason: normalized ? null : "invalid_preview_url",
  };
}

export function tracePreviewUrlCandidates(
  resolution: PreviewIframeUrlResolution,
  context?: { projectId?: string },
): void {
  if (typeof console === "undefined") return;
  console.info("[preview-iframe-url]", {
    projectId: context?.projectId ?? null,
    source: resolution.source,
    selectedPreviewUrl: resolution.selectedPreviewUrl,
    normalizedPreviewUrl: resolution.normalizedPreviewUrl,
    iframeSrc: resolution.iframeSrc,
    artifactId: resolution.artifactId,
    route: resolution.route,
    cacheBust: resolution.cacheBust,
    wasNormalized: resolution.wasNormalized,
    wasRejected: resolution.wasRejected,
    rejectReason: resolution.rejectReason,
    candidates: resolution.candidates,
  });
}

export function resolvePreviewIframeUrl(input: {
  projectId: string;
  route?: string | null;
  cacheBust?: string | number | null;
  artifactId?: string | null;
  candidates: PreviewUrlCandidate[];
}): PreviewIframeUrlResolution {
  const route = input.route?.trim() ? (input.route.startsWith("/") ? input.route : `/${input.route}`) : "/";
  const cacheBust = input.cacheBust ?? null;
  const artifactId = input.artifactId?.trim() || null;

  const evaluated = input.candidates.map((c) => evaluateCandidate(c.source, c.url));

  const pickOrder = [...SOURCE_PRIORITY];
  for (const ev of evaluated) {
    if (!pickOrder.includes(ev.source)) pickOrder.push(ev.source);
  }

  let selected: (typeof evaluated)[number] | null = null;
  for (const source of pickOrder) {
    const match = evaluated.find((e) => e.source === source && e.normalized && !e.rejected);
    if (!match?.normalized) continue;
    const urlArtifact = extractArtifactIdFromPreviewUrl(match.normalized);
    if (artifactId && urlArtifact && urlArtifact !== artifactId) {
      continue;
    }
    selected = match;
    break;
  }

  let normalizedPreviewUrl: string | null = selected?.normalized ?? null;
  let source: PreviewIframeUrlResolution["source"] = selected?.source ?? "none";
  let wasNormalized = Boolean(selected?.raw && normalizedPreviewUrl && selected.raw !== normalizedPreviewUrl);
  let wasRejected = false;
  let rejectReason: string | null = selected?.rejectReason ?? null;

  if (!normalizedPreviewUrl || isRelativeApiProjectsPath(normalizedPreviewUrl)) {
    wasRejected = true;
    rejectReason = rejectReason ?? "no_valid_candidate";
    if (input.projectId) {
      normalizedPreviewUrl = buildInternalPreviewHtmlUrl({
        projectId: input.projectId,
        route,
        cacheBust: cacheBust ?? undefined,
        artifactBuildId: artifactId,
      });
      source = "rebuilt_canonical";
      wasNormalized = true;
      rejectReason = null;
      wasRejected = false;
    }
  } else if (artifactId && !extractArtifactIdFromPreviewUrl(normalizedPreviewUrl)) {
    normalizedPreviewUrl = buildInternalPreviewHtmlUrl({
      projectId: input.projectId,
      route,
      cacheBust: cacheBust ?? undefined,
      artifactBuildId: artifactId,
    });
    source = "rebuilt_canonical";
    wasNormalized = true;
  }

  let iframeSrc: string | null = null;
  if (normalizedPreviewUrl) {
    try {
      if (isRelativeApiProjectsPath(normalizedPreviewUrl)) {
        normalizedPreviewUrl = normalizeInternalPreviewUrl(
          normalizedPreviewUrl.startsWith("api/projects/") ? `/${normalizedPreviewUrl}` : normalizedPreviewUrl,
        );
      }
      iframeSrc = toPreviewIframeSrc(normalizedPreviewUrl);
      if (isRelativeApiProjectsPath(iframeSrc)) {
        iframeSrc = null;
        wasRejected = true;
        rejectReason = "iframe_src_still_relative";
      }
    } catch (e) {
      iframeSrc = null;
      wasRejected = true;
      rejectReason = e instanceof Error ? e.message : "iframe_src_build_failed";
    }
  }

  const resolution: PreviewIframeUrlResolution = {
    selectedPreviewUrl: selected?.raw ?? normalizedPreviewUrl,
    normalizedPreviewUrl,
    iframeSrc,
    source,
    artifactId,
    route,
    cacheBust,
    wasNormalized,
    wasRejected,
    rejectReason,
    candidates: evaluated,
  };

  tracePreviewUrlCandidates(resolution, { projectId: input.projectId });
  return resolution;
}

export function previewIframeDomKey(input: {
  projectId: string;
  artifactId?: string | null;
  route?: string;
  normalizedSrc?: string | null;
  cacheBust?: string | number | null;
  reloadKey?: string | number;
}): string {
  return [
    input.projectId,
    input.artifactId ?? "no-artifact",
    input.route ?? "/",
    input.normalizedSrc ?? "no-src",
    input.cacheBust ?? "0",
    input.reloadKey ?? "0",
  ].join("::");
}
