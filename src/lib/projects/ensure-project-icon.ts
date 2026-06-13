import { buildInitialsIconSvg } from "@/lib/projects/build-initials-icon-svg";

/** True when stored SVG would render pale/transparent on cards. */
export function isWeakIconSvg(svg: string | null | undefined): boolean {
  if (!svg?.trim()) return true;
  if (!svg.includes("<svg")) return true;
  const lower = svg.toLowerCase();
  if (lower.includes('opacity="0') || lower.includes("opacity:0")) return true;
  const hasSolidRect =
    /<rect[^>]+fill=(?!["']none["'])/i.test(svg) ||
    /fill="url\(#/i.test(svg) ||
    /<rect[^>]+fill:\s*(?!none)/i.test(svg);
  const hasSolidCircle = /<circle[^>]+fill=(?!["']none["'])/i.test(svg);
  const hasSolidPath = /<path[^>]+fill=(?!["']none["'])/i.test(svg);
  if (!hasSolidRect && !hasSolidCircle && !hasSolidPath) return true;
  const whiteFill =
    /fill=["'](#fff(?:fff)?|white)["']/i.test(svg) ||
    /fill:\s*(#fff(?:fff)?|white)\b/i.test(svg) ||
    /fill=["']rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(svg);
  const hasDarkBackdrop =
    /fill=["'](#(?:0{3}|[0-9a-f]{6}))["']/i.test(svg) ||
    /fill:\s*hsl\(/i.test(svg) ||
    /linearGradient/i.test(svg);
  if (whiteFill && !hasDarkBackdrop) return true;
  return false;
}

function isRemoteOrStoredIconUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("/") ||
    u.startsWith("blob:")
  );
}

/** Deterministic icon — never returns weak/transparent SVG. */
export function ensureProjectIconSvg(title: string, stored?: string | null): string {
  const name = title.trim() || "App";
  if (stored?.trim() && !isWeakIconSvg(stored)) return stored.trim();
  return buildInitialsIconSvg(name);
}

export function projectIconSrc(
  projectId: string,
  iconSvg?: string | null,
  iconUrl?: string | null,
  cacheKey?: string | null,
): string {
  const key = cacheKey?.trim();
  const bust = key ? `?v=${encodeURIComponent(key)}` : "";
  const storedUrl = iconUrl?.trim();
  if (storedUrl && isRemoteOrStoredIconUrl(storedUrl)) {
    if (storedUrl.startsWith("data:")) return storedUrl;
    if (!key) return storedUrl;
    const sep = storedUrl.includes("?") ? "&" : "?";
    return `${storedUrl}${sep}v=${encodeURIComponent(key)}`;
  }
  if (iconSvg?.trim() && !isWeakIconSvg(iconSvg)) {
    return `data:image/svg+xml,${encodeURIComponent(iconSvg.trim())}`;
  }
  const fallback = `/api/projects/${projectId}/icon`;
  return bust ? `${fallback}${bust}` : fallback;
}

/** True when the app has a real generated or imported icon — not the deterministic initials fallback. */
export function projectHasGeneratedIcon(input: {
  iconUrl?: string | null;
  iconSvg?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = input.metadata ?? {};
  const mode = typeof meta.icon_generation_mode === "string" ? meta.icon_generation_mode : null;
  if (mode === "ai_openai_mini" || mode === "ai_generated") return true;
  if (typeof meta.logo_generated_at === "string" && meta.logo_generated_at) return true;
  const imported = meta.imported_from_zip === true || meta.source === "zip_import";
  if (imported && input.iconUrl?.trim()) return true;
  const url = input.iconUrl?.trim() ?? "";
  if (url && (url.startsWith("http") || url.includes("project-icons"))) return true;
  if (input.iconSvg?.trim() && !isWeakIconSvg(input.iconSvg)) {
    if (mode && mode.startsWith("skipped")) return false;
    if (imported) return true;
  }
  return false;
}
