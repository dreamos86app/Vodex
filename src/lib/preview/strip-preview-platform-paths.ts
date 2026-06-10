/** Remove embedded preview-proxy paths from artifact HTML/JS (fixes Next.js router 404). */
export function stripPreviewPlatformPathsFromText(
  text: string,
  projectId: string,
  opts?: { rewriteAssetUrls?: boolean },
): string {
  const esc = projectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`/api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
    new RegExp(`api/projects/${esc}/preview-html[^"'\\s>]*`, "gi"),
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

  out = out.replace(/"page"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"page":"/"');
  out = out.replace(/"asPath"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"asPath":"/"');
  out = out.replace(/"pathname"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"pathname":"/"');
  out = out.replace(/"url"\s*:\s*"[^"]*preview-html[^"]*"/gi, '"url":"/"');

  // Next.js App Router flight / RSC payloads
  out = out.replace(/\\u002Fapi\\u002Fprojects\\u002F[^"\\]+\\u002Fpreview-html[^"\\]*/gi, "\\u002F");
  out = out.replace(/"initialTree"[^[]*\[[^\]]*preview-html[^\]]*\]/gi, (m) =>
    m.replace(/preview-html[^"'\]]*/gi, ""),
  );

  // Encoded path segments in bundles
  out = out.replace(
    new RegExp(`(?:%2F|\\\\u002F)?api(?:%2F|\\\\u002F)projects(?:%2F|\\\\u002F)${esc}(?:%2F|\\\\u002F)preview-html[^"'\\s>]*`, "gi"),
    "/",
  );

  return out;
}
