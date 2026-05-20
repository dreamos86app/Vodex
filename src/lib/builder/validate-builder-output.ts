import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";
import type { BuilderOutputContract } from "@/lib/creation/parse-builder-metadata";

export type BuilderValidationResult = {
  ok: boolean;
  reasons: string[];
  repairHints: string[];
};

const UNSTYLED_HTML_PATTERNS = [
  /<button(?![^>]*class=)/i,
  /<body[^>]*>\s*<h1>/i,
  /font-family:\s*serif/i,
];

export function validateBuilderOutput(
  meta: BuilderOutputContract | null,
  files: Array<{ path: string; content: string }>,
): BuilderValidationResult {
  const reasons: string[] = [];
  const repairHints: string[] = [];

  if (!meta?.app?.name?.trim()) {
    reasons.push("missing app name");
    repairHints.push("Set app.name to a specific product name derived from the user prompt.");
  }

  const fileQuality = validateGeneratedBuild(files);
  if (!fileQuality.ok) {
    reasons.push(...fileQuality.reasons);
  }
  if (files.length === 0) {
    reasons.push("no files array or fenced file blocks");
    repairHints.push("Emit at least one preview HTML file and 3+ screen files with file= paths.");
  }

  const previewHtml =
    files.find((f) => /preview/i.test(f.path) && /\.html?$/i.test(f.path))?.content ?? "";
  const combined = files.map((f) => f.content).join("\n");
  for (const pat of UNSTYLED_HTML_PATTERNS) {
    if (pat.test(previewHtml || combined)) {
      reasons.push("unstyled or default browser UI detected");
      repairHints.push("Use Tailwind/CSS classes, cards, nav, and a cohesive color theme.");
      break;
    }
  }

  if (!meta?.pages?.length) {
    repairHints.push("Include pages[] with at least 3 named screens and routes.");
  }

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    repairHints,
  };
}
