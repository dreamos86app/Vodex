/**
 * Internal preview proxy URLs must always be absolute platform API paths (`/api/projects/...`).
 * Relative `api/projects/...` resolves inside generated app routing and 404s.
 */

const INTERNAL_PREVIEW_PREFIX = "/api/projects/";
const VIRTUAL_PREVIEW_PREFIX = "/preview-runtime/";

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
    if (typeof console !== "undefined") {
      console.warn("[preview-url] corrected relative preview API path", { from: trimmed, to: fixed });
    }
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
  const trimmed = pathOrUrl.trim();
  if (isVirtualPreviewRuntimePath(trimmed)) {
    if (typeof window !== "undefined") {
      return new URL(trimmed, window.location.origin).href;
    }
    if (origin) return new URL(trimmed, origin).href;
    return trimmed;
  }
  const path = normalizeInternalPreviewUrl(pathOrUrl);
  if (path.includes("api/projects/") && !path.startsWith("/api/projects/")) {
    throw new InvalidInternalPreviewUrlError("Preview iframe src still relative after normalization");
  }
  if (typeof window !== "undefined") {
    const href = new URL(path, window.location.origin).href;
    if (href.includes("api/projects/") && !href.includes("/api/projects/")) {
      throw new InvalidInternalPreviewUrlError("Preview iframe href resolved to relative api/projects path");
    }
    return href;
  }
  if (origin) {
    return new URL(path, origin).href;
  }
  return path;
}

/** Normalize stored preview_url from DB; persists correction when persist=true and admin client provided. */
export async function normalizeStoredPreviewUrl(input: {
  projectId: string;
  previewUrl: string | null | undefined;
  persist?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin?: { from: (table: string) => any } | null;
}): Promise<string | null> {
  if (!input.previewUrl?.trim()) return null;
  const normalized = tryNormalizeInternalPreviewUrl(input.previewUrl);
  if (!normalized) return null;
  if (normalized !== input.previewUrl.trim() && input.persist && input.admin) {
    await input.admin
      .from("projects")
      .update({ preview_url: normalized })
      .eq("id", input.projectId);
  }
  return normalized;
}

/** Virtual preview path — browser pathname is the app route, not the API proxy. */
export function buildVirtualPreviewRuntimeUrl(input: {
  projectId: string;
  artifactBuildId: string;
  route?: string | null;
  cacheBust?: string | number;
}): string {
  const route = input.route?.trim();
  const normalizedRoute =
    route && route !== "/" ? (route.startsWith("/") ? route : `/${route}`) : "/";
  const pathSeg =
    normalizedRoute === "/"
      ? ""
      : normalizedRoute
          .split("/")
          .filter(Boolean)
          .map((seg) => encodeURIComponent(seg))
          .join("/");
  const base = `${VIRTUAL_PREVIEW_PREFIX}${encodeURIComponent(input.projectId)}/${encodeURIComponent(input.artifactBuildId)}${pathSeg ? `/${pathSeg}` : ""}`;
  const bust = input.cacheBust;
  if (bust != null && bust !== "" && bust !== 0 && bust !== "0") {
    return `${base}?v=${encodeURIComponent(String(bust))}`;
  }
  return base;
}

/** Canonical builder iframe mount URL for a stored artifact build. */
export function canonicalPreviewRuntimeUrl(projectId: string, artifactBuildId: string): string {
  return buildVirtualPreviewRuntimeUrl({ projectId, artifactBuildId, route: "/" });
}

/** Persist preview-runtime URL when DB still has legacy preview-html paths. */
export async function persistCanonicalPreviewRuntimeUrl(input: {
  projectId: string;
  artifactBuildId: string;
  currentPreviewUrl: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any } | null;
}): Promise<string> {
  const canonical = canonicalPreviewRuntimeUrl(input.projectId, input.artifactBuildId);
  const current = input.currentPreviewUrl?.trim() ?? "";
  const needsUpdate =
    !current ||
    current.includes("/preview-html") ||
    !current.includes("/preview-runtime/") ||
    current !== canonical;
  if (needsUpdate && input.admin) {
    await input.admin.from("projects").update({ preview_url: canonical }).eq("id", input.projectId);
    return canonical;
  }
  return current || canonical;
}

export function isVirtualPreviewRuntimePath(url: string): boolean {
  return url.startsWith(VIRTUAL_PREVIEW_PREFIX);
}

/** Strip cache-bust query params so iframe src does not churn on poll/refresh. */
export function stripPreviewCacheBustFromUrl(url: string): string {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://vodex.dev";
    const parsed = new URL(url.trim(), base);
    parsed.searchParams.delete("v");
    return parsed.href;
  } catch {
    return url.replace(/([?&])v=[^&]+&?/g, "$1").replace(/[?&]$/, "");
  }
}

/** Canonical mount URL for iframe — stable href without cache bust. */
export function canonicalPreviewMountUrl(url: string): string {
  return stripPreviewCacheBustFromUrl(url);
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
  const bust = input.cacheBust;
  if (bust != null && bust !== "" && bust !== 0 && bust !== "0") {
    params.set("v", String(bust));
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
