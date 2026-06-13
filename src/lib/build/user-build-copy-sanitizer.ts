/**
 * Central sanitizer — user-visible build/chat copy must never expose quality scores or retry debug.
 */

export const BUILD_PAUSED_HEADLINE = "Build paused — app is not ready yet";
export const BUILD_NEEDS_ANOTHER_PASS =
  "Build needs another generation pass before preview.";
export const BUILD_INCOMPLETE_NO_BROKEN_PREVIEW =
  "Some screens are still incomplete, so I'm continuing the build instead of showing a broken preview.";
export const PREVIEW_NOT_AVAILABLE_YET =
  "Preview not available yet — generation is still continuing.";
export const CONTINUE_GENERATION_LABEL = "Continue generation";

const USER_FACING_DEBUG_PATTERNS = [
  /quality\s*(score)?\s*:?\s*\d+\s*\/\s*\d+/gi,
  /\b\d+\s*\/\s*100\b/g,
  /production quality floor/gi,
  /meaningful routes/gi,
  /\bwired\s*\d+/gi,
  /\b\d+\s*\/\s*\d+\s*meaningful/gi,
  /0\s*files\s*·/gi,
  /components\s*·\s*wired/gi,
  /retry\s*\d+\s*\/\s*\d+/gi,
  /continuation pass\s+\d+/gi,
  /continuation pass.*timed out/gi,
  /timed out at\s+\d+s/gi,
  /compact route retry/gi,
  /output did not meet/gi,
  /quality below the production floor/gi,
  /quality repair needed/gi,
  /ui_quality_\d+/gi,
  /Build blocked.*quality/gi,
  /Logo:\s*Logo generated/gi,
  /Import graph:/gi,
  /Model:\s*\S+/gi,
  /Files:\s*\d+/gi,
  /Preview:\s*Preview with quality/gi,
];

export function containsUserFacingBuildDebug(text: string): boolean {
  if (!text.trim()) return false;
  return USER_FACING_DEBUG_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/** Strip technical quality gate copy from user-visible chat. */
export function sanitizeUserBuildChatText(text: string): string {
  if (!text.trim()) return text;
  if (containsUserFacingBuildDebug(text)) {
    if (/paused|blocked|incomplete|continuing|not ready/i.test(text)) {
      return [BUILD_PAUSED_HEADLINE, BUILD_NEEDS_ANOTHER_PASS].join("\n");
    }
    if (/continuation|smaller|route-by-route|chunk/i.test(text)) {
      return "I'm switching to smaller sections so the app can finish reliably.";
    }
    if (/dashboard|feature|screen/i.test(text)) {
      return "I'm adding the dashboard and feature screens next.";
    }
    return BUILD_NEEDS_ANOTHER_PASS;
  }
  let out = text;
  for (const re of USER_FACING_DEBUG_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, "");
  }
  return out
    .replace(/Why blocked:.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function userBlockedBuildSummary(): string {
  return [BUILD_PAUSED_HEADLINE, BUILD_NEEDS_ANOTHER_PASS, CONTINUE_GENERATION_LABEL].join("\n");
}

export function userContinuationProgressLine(pass: number): string {
  if (pass <= 1) {
    return "Some screens were incomplete, so I'm continuing generation.";
  }
  return "Core layout is ready. I'm adding dashboard and feature screens next.";
}

export function isTechnicalBuildDebugText(text: string): boolean {
  return containsUserFacingBuildDebug(text) || /retry\s*\d+\s*\/\s*\d+/i.test(text);
}
