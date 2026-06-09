/** Plain product language for build chat — never expose quality scores to users. */

export const BUILD_PAUSED_HEADLINE = "Build paused — app is not ready yet";
export const BUILD_NEEDS_ANOTHER_PASS =
  "Build needs another generation pass before preview.";
export const BUILD_INCOMPLETE_NO_BROKEN_PREVIEW =
  "Some screens are still incomplete, so I'm continuing the build instead of showing a broken preview.";
export const PREVIEW_NOT_AVAILABLE_YET =
  "Preview not available yet — generation is still continuing.";
export const CONTINUE_GENERATION_LABEL = "Continue generation";

const QUALITY_SCORE_RE =
  /quality\s*(score)?\s*:?\s*\d+\s*\/\s*\d+|\d+\s*\/\s*100|production quality floor|meaningful routes|output did not meet|quality below the production floor|quality repair needed/gi;

/** Strip technical quality gate copy from user-visible chat. */
export function sanitizeUserBuildChatText(text: string): string {
  if (!text.trim()) return text;
  if (QUALITY_SCORE_RE.test(text)) {
    if (/paused|blocked|incomplete|continuing/i.test(text)) {
      return [BUILD_PAUSED_HEADLINE, BUILD_NEEDS_ANOTHER_PASS].join("\n");
    }
    return BUILD_NEEDS_ANOTHER_PASS;
  }
  return text
    .replace(/Quality score:\s*\d+\/\d+/gi, "")
    .replace(/\d+\/\d+\s*meaningful routes/gi, "")
    .replace(/Why blocked:.*$/gim, "")
    .replace(/production quality floor/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function userBlockedBuildSummary(): string {
  return [BUILD_PAUSED_HEADLINE, BUILD_NEEDS_ANOTHER_PASS, CONTINUE_GENERATION_LABEL].join("\n");
}
