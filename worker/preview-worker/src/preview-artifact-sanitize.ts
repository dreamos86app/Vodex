/** Mirror of platform strip-preview-platform-paths for worker upload-time sanitization. */

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
  out = out.replace(/preview-html/gi, (m, offset, full) => {
    const before = full.slice(Math.max(0, offset - 40), offset);
    if (/api\/projects\//i.test(before) || /api\\u002Fprojects\\u002F/i.test(before)) return "/";
    return m;
  });

  return out;
}

export function shouldSanitizeArtifactFile(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return (
    lower.endsWith(".html") ||
    lower.endsWith(".js") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".json") ||
    lower.endsWith(".txt")
  );
}

export function sanitizeArtifactBuffer(
  buf: Buffer,
  relPath: string,
  projectId: string,
): Buffer {
  if (!shouldSanitizeArtifactFile(relPath)) return buf;
  const text = buf.toString("utf8");
  const isJs = relPath.toLowerCase().endsWith(".js") || relPath.toLowerCase().endsWith(".mjs");
  const stripped = stripPreviewPlatformPathsFromText(text, projectId, {
    rewriteAssetUrls: !isJs,
  });
  return Buffer.from(stripped, "utf8");
}
