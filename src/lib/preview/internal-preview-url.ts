/**
 * Internal preview proxy URLs must always be absolute platform API paths (`/api/projects/...`).
 * Relative `api/projects/...` resolves inside generated app routing and 404s.
 */

const INTERNAL_PREVIEW_PREFIX = "/api/projects/";

export class InvalidInternalPreviewUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInternalPreviewUrlError";
  }
}

/** Normalize to `/api/projects/...` path (with query). Throws if not a preview API route. */
export function normalizeInternalPreviewUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new InvalidInternalPreviewUrlError("Preview route URL invalid — empty URL");
  }

  if (trimmed.startsWith(INTERNAL_PREVIEW_PREFIX)) {
    assertInternalPreviewUrl(trimmed);
    return trimmed;
  }

  if (trimmed.startsWith("api/projects/")) {
    const fixed = `/${trimmed}`;
    assertInternalPreviewUrl(fixed);
    return fixed;
  }

  try {
    const parsed = new URL(trimmed, "https://preview.local");
    if (parsed.pathname.startsWith(INTERNAL_PREVIEW_PREFIX)) {
      const path = `${parsed.pathname}${parsed.search}`;
      assertInternalPreviewUrl(path);
      return path;
    }
  } catch {
    /* fall through */
  }

  throw new InvalidInternalPreviewUrlError(
    `Preview route URL invalid — expected ${INTERNAL_PREVIEW_PREFIX}<id>/preview-html, got: ${trimmed.slice(0, 120)}`,
  );
}

/** Hard guard — every internal Vodex preview iframe/proxy URL must start with `/api/projects/`. */
export function assertInternalPreviewUrl(url: string): void {
  if (!url.startsWith(INTERNAL_PREVIEW_PREFIX)) {
    throw new InvalidInternalPreviewUrlError(
      `Preview route URL invalid — must start with ${INTERNAL_PREVIEW_PREFIX}`,
    );
  }
  if (!url.includes("/preview-html") && !url.includes("/preview-assets")) {
    throw new InvalidInternalPreviewUrlError(
      "Preview route URL invalid — must target preview-html or preview-assets",
    );
  }
}

/** Safe normalize — returns null instead of throwing (for stored DB values). */
export function tryNormalizeInternalPreviewUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return normalizeInternalPreviewUrl(url);
  } catch {
    return null;
  }
}

/** Iframe src on the Vodex platform origin (never relative to generated app routes). */
export function toPreviewIframeSrc(pathOrUrl: string, origin?: string): string {
  const path = normalizeInternalPreviewUrl(pathOrUrl);
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).href;
  }
  if (origin) {
    return new URL(path, origin).href;
  }
  return path;
}

/** Build preview-html frame path with route + optional artifact build id. */
export function buildInternalPreviewHtmlUrl(input: {
  projectId: string;
  route?: string | null;
  cacheBust?: string | number;
  artifactBuildId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("format", "frame");
  if (input.cacheBust != null && input.cacheBust !== "") {
    params.set("v", String(input.cacheBust));
  }
  if (input.artifactBuildId) {
    params.set("artifact", input.artifactBuildId);
  }
  const route = input.route?.trim();
  if (route && route !== "/") {
    params.set("route", route.startsWith("/") ? route : `/${route}`);
  }
  const url = `/api/projects/${encodeURIComponent(input.projectId)}/preview-html?${params.toString()}`;
  assertInternalPreviewUrl(url);
  return url;
}
