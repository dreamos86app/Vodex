/** Remove embedded preview-proxy paths from artifact HTML/JS (fixes Next.js router 404). */

function stripVodexExternalLinks(text: string): string {
  return text
    .replace(/https?:\/\/(?:www\.)?vodex\.dev(\/[^"'\s>]*)?/gi, (_, p: string) => p || "/")
    .replace(/https?:\/\/[^"'\s>]*\.vodex\.app(\/[^"'\s>]*)?/gi, (_, p: string) => p || "/");
}

export function stripPreviewPlatformPathsFromText(
  text: string,
  projectId: string,
  opts?: { rewriteAssetUrls?: boolean },
): string {
  const esc = projectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns: RegExp[] = [
    new RegExp(`/api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api\\\\/projects\\\\/${esc}\\\\/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api\\\\u002Fprojects\\\\u002F${esc}\\\\u002Fpreview-html[^"'\\s>]*`, "gi"),
    new RegExp(`(?:%2F)?api%2Fprojects%2F${esc}(?:%2F)?preview-html[^"'\\s>]*`, "gi"),
  ];
  if (opts?.rewriteAssetUrls !== false) {
    patterns.push(
      new RegExp(`/api/projects/${esc}/preview-assets[^"'\\s>]*`, "gi"),
      new RegExp(`api/projects/${esc}/preview-assets[^"'\\s>]*`, "gi"),
    );
  }

  let out = text;
  for (const pattern of patterns) {
    out = out.replace(pattern, "/");
  }

  out = out.replace(/api\/projects\/[a-f0-9-]{36}\/preview-html[^"'\\s>]*/gi, "/");
  out = out.replace(/"page"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"page":"/"');
  out = out.replace(/"asPath"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"asPath":"/"');
  out = out.replace(/"pathname"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"pathname":"/"');
  out = out.replace(/"url"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"url":"/"');
  out = out.replace(/"initialTree"[^[]*\[[^\]]*preview-html[^\]]*\]/gi, (m) =>
    m.replace(/preview-html[^"'\]]*/gi, ""),
  );
  out = out.replace(/__next_f\.push\(\[[^\]]*preview-html[^\]]*\]/gi, (m) =>
    m.replace(/preview-html[^"'\]]*/gi, ""),
  );
  out = out.replace(/\\u002Fapi\\u002Fprojects\\u002F[^"\\]+\\u002Fpreview-html[^"\\]*/gi, "\\u002F");

  return stripVodexExternalLinks(out);
}
