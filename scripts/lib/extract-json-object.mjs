/**
 * Extract the first valid JSON object from noisy CLI stdout (npm banners, warnings, etc.).
 */
export function extractFirstJsonObject(text) {
  if (!text || typeof text !== "string") return null;

  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Strict preview PASS rule shared by production-readiness-report and verify scripts.
 */
export function isPreviewDiagnosticsPass(report) {
  if (!report || typeof report !== "object") return false;
  return (
    report.preview_renderable === true &&
    report.rebuild_required === false &&
    (report.unsafe_path_count ?? 0) === 0 &&
    (report.hydration_path_count ?? 0) === 0 &&
    (Array.isArray(report.issues) ? report.issues.length === 0 : true)
  );
}
