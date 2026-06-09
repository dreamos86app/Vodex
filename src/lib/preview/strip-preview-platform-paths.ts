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

  return out;
}
