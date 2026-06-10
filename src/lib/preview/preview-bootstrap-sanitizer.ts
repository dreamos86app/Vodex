/**
 * Sanitize imported-app bootstrap state so platform preview paths never poison Next router / hydration.
 */

import {
  scanTextForPathLeaks,
  type PathLeakMatch,
} from "@/lib/preview/preview-path-leak-scanner";

export type BootstrapLeakSource =
  | "served_html"
  | "stored_html"
  | "js_chunk"
  | "rsc_payload"
  | "next_data"
  | "next_f_push"
  | "router_cache"
  | "unknown";

export type DetailedBootstrapLeak = PathLeakMatch & {
  source: BootstrapLeakSource;
  file?: string;
};

const PLATFORM_INJECTION_RE =
  /<script\b[^>]*(?:data-vodex-preview-(?:watchdog|shim)|id="vodex-preview-(?:inner-watchdog|virtual-history|prehydration-location-rewrite|boot-audit)")[^>]*>[\s\S]*?<\/script>/gi;

/** Remove Vodex-injected preview shims before scanning artifact bootstrap content. */
export function stripPlatformInjectionScripts(html: string): string {
  return html.replace(PLATFORM_INJECTION_RE, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function platformPreviewPathPatterns(projectId: string, includeAssetUrls = true): RegExp[] {
  const esc = escapeRegExp(projectId);
  const patterns = [
    new RegExp(`/api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`https?:\\/\\/(?:www\\.)?vodex\\.dev\\/api\\/projects\\/${esc}\\/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api\\\\/projects\\\\/${esc}\\\\/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api\\\\u002Fprojects\\\\u002F${esc}\\\\u002Fpreview-html[^"'\\s>]*`, "gi"),
    new RegExp(`(?:%2F)?api%2Fprojects%2F${esc}(?:%2F)?preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`(?:%2F)?api%2Fprojects%2F${esc}%2Fpreview-html[^"'\\s>]*`, "gi"),
    /preview-html[^"'\\s>]*(?:format=frame|format%3Dframe)[^"'\\s>]*/gi,
    /api\/projects\/[a-f0-9-]{36}\/preview-html[^"'\\s>]*/gi,
    /https?:\/\/(?:www\.)?vodex\.dev\/api\/projects\/[a-f0-9-]{36}\/preview-html[^"'\\s>]*/gi,
    /api\\u002Fprojects\\u002F[a-f0-9-]+\\u002Fpreview-html/gi,
    /api\\\/projects\\\/[a-f0-9-]+\\\/preview-html/gi,
    /(?:%2F)?api%2Fprojects%2F[a-f0-9-]+%2Fpreview-html/gi,
    /** P1.3.39 — preview-runtime iframe route poisons Next router if not stripped. */
    new RegExp(`/preview-runtime/${esc}/[a-f0-9-]{36}(?!/assets)`, "gi"),
    new RegExp(`preview-runtime/${esc}/[a-f0-9-]{36}(?!/assets)`, "gi"),
    /\/preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?!\/assets)/gi,
    /preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?!\/assets)/gi,
  ];
  if (includeAssetUrls) {
    patterns.push(
      new RegExp(`/api/projects/${esc}/preview-assets[^"'\\s>]*`, "gi"),
      new RegExp(`api/projects/${esc}/preview-assets[^"'\\s>]*`, "gi"),
    );
  }
  return patterns;
}

function containsPlatformPreviewPath(value: string, projectId: string): boolean {
  if (!value) return false;
  for (const re of platformPreviewPathPatterns(projectId)) {
    re.lastIndex = 0;
    if (re.test(value)) return true;
  }
  return (
    /preview-html/i.test(value) && /api\/projects|api%2Fprojects|\\u002Fapi/i.test(value)
  ) || /preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?!\/assets)/i.test(value);
}

function fixPathString(value: string, projectId: string, virtualRoute: string): string {
  if (!containsPlatformPreviewPath(value, projectId)) return value;
  return virtualRoute || "/";
}

function deepSanitizeBootstrapValue(
  value: unknown,
  projectId: string,
  virtualRoute: string,
): unknown {
  if (typeof value === "string") {
    let out = value;
    for (const re of platformPreviewPathPatterns(projectId)) {
      out = out.replace(re, virtualRoute || "/");
    }
    out = out.replace(/"page"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"page":"${virtualRoute || "/"}"`);
    if (containsPlatformPreviewPath(out, projectId)) {
      return fixPathString(out, projectId, virtualRoute);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepSanitizeBootstrapValue(v, projectId, virtualRoute));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepSanitizeBootstrapValue(v, projectId, virtualRoute);
    }
    return out;
  }
  return value;
}

function sanitizeNextDataScript(html: string, projectId: string, virtualRoute: string): string {
  return html.replace(
    /<script([^>]*\bid=["']__NEXT_DATA__["'][^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, json) => {
      try {
        const parsed = JSON.parse(json) as Record<string, unknown>;
        for (const key of ["page", "asPath", "pathname", "url", "assetPrefix", "dynamicIds"]) {
          if (key in parsed) {
            parsed[key] = deepSanitizeBootstrapValue(parsed[key], projectId, virtualRoute);
          }
        }
        if (parsed.props) parsed.props = deepSanitizeBootstrapValue(parsed.props, projectId, virtualRoute);
        if (parsed.rsc) parsed.rsc = deepSanitizeBootstrapValue(parsed.rsc, projectId, virtualRoute);
        return `<script${attrs}>${JSON.stringify(parsed)}</script>`;
      } catch {
        return sanitizePreviewBootstrapState(full, projectId, virtualRoute, {
          skipNextDataParse: true,
        });
      }
    },
  );
}

export function sanitizePreviewBootstrapState(
  text: string,
  projectId: string,
  virtualRoute = "/",
  opts?: { skipNextDataParse?: boolean; rewriteAssetUrls?: boolean },
): string {
  const route = virtualRoute.startsWith("/") ? virtualRoute : `/${virtualRoute}`;
  let out = text;

  if (!opts?.skipNextDataParse && out.includes("__NEXT_DATA__")) {
    out = sanitizeNextDataScript(out, projectId, route);
  }

  const includeAssetUrls = opts?.rewriteAssetUrls !== false;
  for (const re of platformPreviewPathPatterns(projectId, includeAssetUrls)) {
    out = out.replace(re, route);
  }

  out = out
    .replace(/https?:\/\/(?:www\.)?vodex\.dev(\/[^"'\s>]*)?/gi, (_, p: string) => p || route)
    .replace(/https?:\/\/[^"'\s>]*\.vodex\.app(\/[^"'\s>]*)?/gi, (_, p: string) => p || route)
    .replace(/"page"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"page":"${route}"`)
    .replace(/"asPath"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"asPath":"${route}"`)
    .replace(/"pathname"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"pathname":"${route}"`)
    .replace(/"url"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"url":"${route}"`)
    .replace(/"page"\s*:\s*"[^"]*preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?![^"]*\/assets)[^"]*"/gi, `"page":"${route}"`)
    .replace(/"asPath"\s*:\s*"[^"]*preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?![^"]*\/assets)[^"]*"/gi, `"asPath":"${route}"`)
    .replace(/"pathname"\s*:\s*"[^"]*preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?![^"]*\/assets)[^"]*"/gi, `"pathname":"${route}"`)
    .replace(/"url"\s*:\s*"[^"]*preview-runtime\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?![^"]*\/assets)[^"]*"/gi, `"url":"${route}"`)
    .replace(/"buildId"\s*:\s*"[^"]*preview-html[^"]*"/gi, `"buildId":"${route}"`)
    .replace(/"initialTree"[^[]*\[[^\]]*preview-html[^\]]*\]/gi, (m) =>
      m.replace(/preview-html[^"'\]]*/gi, route.replace(/^\//, "")),
    )
    .replace(/"tree"\s*:\s*\[[^\]]*preview-html[^\]]*\]/gi, (m) =>
      m.replace(/preview-html[^"'\]]*/gi, route.replace(/^\//, "")),
    )
    .replace(/__next_f\.push\(\[[\s\S]*?\]\)/gi, (m) => {
      if (!/preview-html|preview-runtime|api\/projects|api%2Fprojects/i.test(m)) return m;
      return sanitizePreviewBootstrapState(m, projectId, route, { skipNextDataParse: true });
    })
    .replace(/\\u002Fapi\\u002Fprojects\\u002F[^"\\]+\\u002Fpreview-html[^"\\]*/gi, "\\u002F")
    .replace(/self\.__next_f\.push/gi, (m) => m);

  if (opts?.rewriteAssetUrls === false) {
    return out;
  }

  return out;
}

export function classifyBootstrapLeakSource(
  text: string,
  index: number,
  file?: string,
): BootstrapLeakSource {
  if (file) {
    if (/\.rsc$/i.test(file)) return "rsc_payload";
    if (/\.m?js$/i.test(file)) return "js_chunk";
    if (/\.json$/i.test(file)) return /app-paths|build-manifest|routes-manifest/i.test(file) ? "router_cache" as BootstrapLeakSource : "js_chunk";
    if (/\.html?$/i.test(file)) return "stored_html";
  }
  const before = text.slice(Math.max(0, index - 120), index);
  const after = text.slice(index, Math.min(text.length, index + 120));
  const ctx = before + after;
  if (/id=["']__NEXT_DATA__["']/i.test(ctx) || before.includes("__NEXT_DATA__")) return "next_data";
  if (/__next_f\.push/i.test(ctx)) return "next_f_push";
  if (/initialTree|"tree"|router/i.test(ctx)) return "rsc_payload";
  return "served_html";
}

export function scanBootstrapLeaksDetailed(
  text: string,
  projectId: string,
  opts?: { excludePlatformInjections?: boolean; file?: string },
): DetailedBootstrapLeak[] {
  const hay = opts?.excludePlatformInjections ? stripPlatformInjectionScripts(text) : text;
  const leaks = scanTextForPathLeaks(hay, projectId).filter((m) => !m.safe);
  return leaks.map((leak) => ({
    ...leak,
    source: classifyBootstrapLeakSource(hay, leak.index, opts?.file),
    file: opts?.file,
  }));
}

export function countHydrationPathLeaks(text: string, projectId: string, excludeInjections = true): number {
  const hay = excludeInjections ? stripPlatformInjectionScripts(text) : text;
  const re = new RegExp(
    `(?:preview-html|preview-runtime\\/[a-f0-9-]{36}\\/[a-f0-9-]{36}(?!\\/assets)|api\\/projects\\/${escapeRegExp(projectId)}\\/preview-html|api%2Fprojects%2F${escapeRegExp(projectId)}%2Fpreview-html)`,
    "gi",
  );
  return (hay.match(re) ?? []).length;
}

export function assertPreviewBootstrapClean(
  html: string,
  projectId: string,
): { ok: true } | { ok: false; leaks: DetailedBootstrapLeak[]; hydrationCount: number } {
  const leaks = scanBootstrapLeaksDetailed(html, projectId, { excludePlatformInjections: true });
  const hydrationCount = countHydrationPathLeaks(html, projectId, true);
  if (leaks.length === 0 && hydrationCount === 0) return { ok: true };
  return { ok: false, leaks, hydrationCount };
}

export function formatBootstrapLeakReport(input: {
  before: string;
  after: string;
  projectId: string;
  label: string;
  file?: string;
}): string {
  const beforeLeaks = scanBootstrapLeaksDetailed(input.before, input.projectId, {
    excludePlatformInjections: true,
    file: input.file,
  });
  const afterLeaks = scanBootstrapLeaksDetailed(input.after, input.projectId, {
    excludePlatformInjections: true,
    file: input.file,
  });
  const lines: string[] = [
    `=== ${input.label} ===`,
    `file: ${input.file ?? "inline"}`,
    `before_unsafe: ${beforeLeaks.length} hydration: ${countHydrationPathLeaks(input.before, input.projectId, true)}`,
    `after_unsafe: ${afterLeaks.length} hydration: ${countHydrationPathLeaks(input.after, input.projectId, true)}`,
  ];
  for (const leak of beforeLeaks) {
    lines.push(`  [${leak.source}] ${leak.pattern}: ${leak.snippet}`);
  }
  if (beforeLeaks.length && afterLeaks.length === 0) {
    lines.push("  sanitizer: cleared all leaks");
  }
  for (const leak of afterLeaks) {
    lines.push(`  REMAINING [${leak.source}] ${leak.pattern}: ${leak.snippet}`);
  }
  return lines.join("\n");
}
