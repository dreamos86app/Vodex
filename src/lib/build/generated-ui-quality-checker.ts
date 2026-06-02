import {
  BASIC_UI_FAILURE_PATTERNS,
  PREVIEW_READY_MIN_SCORE,
  USER_FACING_UI_BANNED,
} from "@/lib/build/ui-quality-contract";
import { reviewGeneratedUi, type UiQualityScore } from "@/lib/generation/generated-ui-review";
import { dashboardQualityScore } from "@/lib/build/dashboard-quality-validator";
import { validateUiRichness } from "@/lib/build/ui-richness-validator";

export type GeneratedUiQualityResult = {
  score: number;
  passesPreview: boolean;
  review: UiQualityScore;
  failures: string[];
  basicUiFailure: boolean;
  dashboardScore: number;
  uiRichnessScore: number;
  uiRichnessPasses: boolean;
};

function scoreBasicUiPenalties(uiContent: string, pageContent: string): { penalty: number; failures: string[] } {
  const failures: string[] = [];
  let penalty = 0;

  if (BASIC_UI_FAILURE_PATTERNS.welcomeOnly.test(pageContent) && BASIC_UI_FAILURE_PATTERNS.noNavigation(uiContent)) {
    failures.push("welcome_only_no_nav");
    penalty += 35;
  }

  if (
    BASIC_UI_FAILURE_PATTERNS.welcomeOnly.test(pageContent) &&
    BASIC_UI_FAILURE_PATTERNS.threePlainCards.test(pageContent) &&
    !/table|thead|chart|filter|sidebar|metric/i.test(pageContent)
  ) {
    failures.push("welcome_plus_plain_cards");
    penalty += 40;
  }

  if (BASIC_UI_FAILURE_PATTERNS.shallowHome(pageContent)) {
    failures.push("shallow_primary_route");
    penalty += 25;
  }

  const cardOnlyHome =
    /welcome/i.test(pageContent) &&
    (pageContent.match(/rounded(-lg|-xl)?\s+.*(?:border|shadow|bg-)/gi) ?? []).length <= 4 &&
    !/table|thead|timeline|calendar|chart/i.test(pageContent);
  if (cardOnlyHome) {
    failures.push("generic_card_stack_home");
    penalty += 30;
  }

  for (const banned of USER_FACING_UI_BANNED) {
    if (banned.test(pageContent)) {
      failures.push(`user_banned:${banned.source.slice(0, 24)}`);
      penalty += 20;
      break;
    }
  }

  const visibleCopy = pageContent.replace(/className="[^"]*"/g, "").replace(/className='[^']*'/g, "");
  if (/\b(?:Next\.?js|Vite|React|Tailwind)\b/i.test(visibleCopy) && !/lucide|icon/i.test(visibleCopy)) {
    failures.push("framework_label_in_ui");
    penalty += 25;
  }

  return { penalty, failures };
}

/** Score generated UI 0–100; preview ready only at ≥ PREVIEW_READY_MIN_SCORE (85). */
export function checkGeneratedUiQuality(input: {
  files: Array<{ path: string; content: string }>;
  appType?: string | null;
  stylePresetId?: string | null;
  routeMap?: string[] | null;
}): GeneratedUiQualityResult {
  const review = reviewGeneratedUi(input);
  const uiContent = input.files
    .filter((f) => /\.(tsx|jsx|html)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");

  const homePath =
    input.files.find((f) => /app\/page\.tsx$/i.test(f.path)) ??
    input.files.find((f) => /page\.tsx$/i.test(f.path) && !/dashboard/i.test(f.path));
  const pageContent = homePath?.content ?? uiContent.slice(0, 4000);

  const { penalty, failures } = scoreBasicUiPenalties(uiContent, pageContent);
  const dash = dashboardQualityScore(input.files);
  const richness = validateUiRichness(input.files);
  const combinedFailures = [
    ...failures,
    ...dash.failures,
    ...richness.failures,
    ...review.issues.slice(0, 6),
  ];
  const score = Math.max(
    0,
    Math.min(100, Math.round((review.overall - penalty + richness.score + dash.score) / 3)),
  );
  const basicUiFailure = failures.some((f) =>
    ["welcome_only_no_nav", "welcome_plus_plain_cards", "generic_card_stack_home", "shallow_primary_route"].includes(f),
  );

  const passesPreview =
    score >= PREVIEW_READY_MIN_SCORE &&
    review.passesGate &&
    !review.placeholderLike &&
    !basicUiFailure &&
    dash.passes &&
    richness.passes;

  return {
    score,
    passesPreview,
    review,
    failures: combinedFailures,
    basicUiFailure,
    dashboardScore: dash.score,
    uiRichnessScore: richness.score,
    uiRichnessPasses: richness.passes,
  };
}

export function previewReadyMinScore(): number {
  return PREVIEW_READY_MIN_SCORE;
}
