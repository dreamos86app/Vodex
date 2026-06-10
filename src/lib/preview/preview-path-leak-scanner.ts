/** Scan artifact text for platform preview path leaks. */

export type PathLeakMatch = {
  pattern: string;
  snippet: string;
  index: number;
  safe: boolean;
  repair: string;
};

const LEAK_PATTERN_DEFS: Array<{ id: string; re: RegExp; safe?: boolean; repair: string }> = [
  { id: "relative_api_projects", re: /(?<![/"'])api\/projects\/[a-f0-9-]+\/preview-html[^"'`\s>]*/gi, repair: "Replace with '/' or virtual app route" },
  { id: "absolute_api_projects", re: /\/api\/projects\/[a-f0-9-]+\/preview-html[^"'`\s>]*/gi, repair: "Strip preview-html proxy path from bundle" },
  {
    id: "preview_runtime_assets",
    re: /\/preview-runtime\/[a-f0-9-]+\/[a-f0-9-]+\/assets[^"'`\s>]*/gi,
    safe: true,
    repair: "Intentional preview-runtime asset URL injected at serve layer",
  },
  {
    id: "preview_assets_leak",
    re: /\/api\/projects\/[a-f0-9-]+\/preview-assets[^"'`\s>]*/gi,
    safe: true,
    repair: "Intentional preview-assets proxy URL injected at serve layer",
  },
  {
    id: "relative_preview_assets",
    re: /(?<![/"'])api\/projects\/[a-f0-9-]+\/preview-assets[^"'`\s>]*/gi,
    safe: true,
    repair: "Intentional preview-assets proxy URL injected at serve layer",
  },
  { id: "escaped_api_projects", re: /api\\u002Fprojects\\u002F[a-f0-9-]+\\u002Fpreview-html/gi, repair: "Normalize unicode-escaped path to '/'" },
  { id: "slash_escaped", re: /api\\\/projects\\\/[a-f0-9-]+\\\/preview-html/gi, repair: "Normalize JSON-escaped path to '/'" },
  { id: "url_encoded", re: /(?:%2F)?api%2Fprojects%2F[a-f0-9-]+%2Fpreview-html/gi, repair: "Decode and replace with '/'" },
  { id: "vodex_dev", re: /https?:\/\/(?:www\.)?vodex\.dev\/[^"'`\s>]*/gi, repair: "Rewrite to in-app virtual path" },
  { id: "vodex_app", re: /https?:\/\/[^"'`\s>]*\.vodex\.app\/[^"'`\s>]*/gi, repair: "Rewrite to in-app virtual path" },
  { id: "preview_html_format_frame", re: /preview-html[^"'`\s>]*format=frame[^"'`\s>]*/gi, repair: "Strip legacy preview-html frame URL" },
  { id: "preview_html_format_frame_encoded", re: /preview-html[^"'`\s>]*format%3Dframe[^"'`\s>]*/gi, repair: "Strip URL-encoded preview-html frame URL" },
  { id: "preview_runtime_route", re: /(?:\/)?preview-runtime\/[a-f0-9-]+\/[a-f0-9-]+(?![^"'`\s>]*\/assets)/gi, repair: "Replace preview-runtime iframe route with '/'" },
  { id: "next_data_page", re: /"page"\s*:\s*"[^"]*preview-html[^"]*"/gi, repair: 'Set "page":"/"' },
  { id: "next_f_push", re: /__next_f\.push\([^)]*preview-html[^)]*\)/gi, repair: "Strip poisoned flight chunk push" },
  { id: "service_worker_register", re: /navigator\.serviceWorker\.register\s*\(/gi, safe: true, repair: "Block SW registration in preview iframe shim" },
];

export function scanTextForPathLeaks(text: string, projectId?: string): PathLeakMatch[] {
  const hay = text;
  const matches: PathLeakMatch[] = [];
  for (const def of LEAK_PATTERN_DEFS) {
    const re = new RegExp(def.re.source, def.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(hay))) {
      if (
        projectId &&
        !m[0].includes(projectId) &&
        /api\/projects|preview-html|preview-runtime/i.test(m[0])
      ) {
        if (!m[0].match(/api\/projects\/[a-f0-9-]+/i) && !m[0].match(/preview-runtime\/[a-f0-9-]+/i)) continue;
      }
      const start = Math.max(0, m.index - 40);
      const end = Math.min(hay.length, m.index + m[0].length + 40);
      matches.push({
        pattern: def.id,
        snippet: hay.slice(start, end).replace(/\s+/g, " ").trim(),
        index: m.index,
        safe: def.safe ?? false,
        repair: def.repair,
      });
    }
  }
  return matches;
}

export const TEXT_ARTIFACT_EXT = /\.(html?|js|mjs|cjs|css|json|txt|rsc|map|webmanifest|xml)$/i;
