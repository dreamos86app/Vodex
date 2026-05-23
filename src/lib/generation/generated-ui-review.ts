import {
  UI_QUALITY_BANNED,
  UI_QUALITY_REQUIRED_PATTERNS,
  UI_QUALITY_THRESHOLDS,
  type UiQualityDimension,
} from "@/lib/generation/ui-quality-spec";
import { scoreAppTypeCompliance } from "@/lib/generation/app-type-ui-requirements";
import { scoreStylePresetApplication } from "@/lib/generation/design-token-presets";

export type UiQualityScore = {
  overall: number;
  dimensions: Record<UiQualityDimension, number>;
  issues: string[];
  placeholderLike: boolean;
  needsPolish: boolean;
  appTypeScore: number;
  stylePresetScore: number;
  passesGate: boolean;
};

function scorePattern(content: string, pattern: RegExp, weight: number): number {
  return pattern.test(content) ? weight : 0;
}

function scorePlaceholderRisk(uiContent: string, placeholderLike: boolean): number {
  if (placeholderLike) return 0;
  let score = 100;
  for (const banned of UI_QUALITY_BANNED) {
    if (banned.test(uiContent)) score -= 25;
  }
  if (uiContent.length < 300) score -= 30;
  if (uiContent.length < 600) score -= 10;
  const unstyled =
    /<(?:div|p|span|button|main|section)(?![^>]*className)/i.test(uiContent) &&
    !UI_QUALITY_REQUIRED_PATTERNS.spacing.test(uiContent);
  if (unstyled) score -= 20;
  return Math.max(0, Math.min(100, score));
}

/** Score generated file content for UI quality (0–100). */
export function reviewGeneratedUi(input: {
  files: Array<{ path: string; content: string }>;
  appType?: string | null;
  stylePresetId?: string | null;
  routeMap?: string[] | null;
}): UiQualityScore {
  const combined = input.files.map((f) => f.content).join("\n");
  const uiFiles = input.files.filter((f) => /\.(tsx|jsx|html|css)$/i.test(f.path));
  const uiContent = uiFiles.map((f) => f.content).join("\n") || combined;

  const issues: string[] = [];
  let placeholderLike = false;

  for (const banned of UI_QUALITY_BANNED) {
    if (banned.test(uiContent)) {
      issues.push(`banned:${banned.source}`);
      placeholderLike = true;
    }
  }

  const onlyHero =
    uiContent.length < 500 &&
    /hero|welcome|landing/i.test(uiContent) &&
    !UI_QUALITY_REQUIRED_PATTERNS.navigation.test(uiContent);
  if (onlyHero) {
    issues.push("placeholder_only_hero");
    placeholderLike = true;
  }

  const fakePrimaryButton =
    /<button[^>]*disabled[^>]*>(?:Get started|Sign up|Submit|Buy|Checkout|Book)/i.test(uiContent) &&
    !/onClick|href=/i.test(uiContent);
  if (fakePrimaryButton) {
    issues.push("fake_disabled_primary_cta");
    placeholderLike = true;
  }

  const appCompliance = scoreAppTypeCompliance({
    files: input.files,
    appType: input.appType,
    routeMap: input.routeMap,
  });
  issues.push(...appCompliance.issues.slice(0, 8));

  const styleResult = scoreStylePresetApplication(input.files, input.stylePresetId);

  const colorScore = Math.min(100, /bg-|text-|border-|ring-/.test(uiContent) ? 85 : 20);
  const componentScore = Math.min(
    100,
    scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.buttons, 40) +
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.cards, 35) +
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.forms, 25),
  );
  const visualPolish = Math.round((colorScore + componentScore + styleResult.score) / 3);

  const placeholderRisk = scorePlaceholderRisk(uiContent, placeholderLike);

  const stateCoverage = Math.min(
    100,
    scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.emptyState, 34) +
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.loadingState, 33) +
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.errorState, 33),
  );

  const dimensions: Record<UiQualityDimension, number> = {
    typography: Math.min(
      100,
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.typography, 65) +
        (uiContent.length > 800 ? 35 : uiContent.length > 400 ? 20 : 5),
    ),
    spacing: Math.min(
      100,
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.spacing, 75) + (uiFiles.length >= 2 ? 25 : 10),
    ),
    layoutCompleteness: Math.min(
      100,
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.navigation, 35) +
        scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.cards, 25) +
        scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.tables, 15) +
        (uiFiles.length >= 3 ? 25 : uiFiles.length * 8),
    ),
    responsiveReadiness: Math.min(
      100,
      scorePattern(uiContent, UI_QUALITY_REQUIRED_PATTERNS.responsive, 80) + 20,
    ),
    appRelevance: appCompliance.score,
    visualPolish,
    interactivity: Math.min(
      100,
      /onClick|onSubmit|useState|href=|router\.push|form/i.test(uiContent) ? 88 : 25,
    ),
    placeholderRisk,
    stateCoverage,
    routeCompleteness: appCompliance.routeCompleteness,
    stylePresetApplication: styleResult.score,
    colorConsistency: colorScore,
    componentQuality: componentScore,
  };

  const primaryDims: UiQualityDimension[] = [
    "typography",
    "spacing",
    "layoutCompleteness",
    "responsiveReadiness",
    "appRelevance",
    "visualPolish",
    "interactivity",
    "placeholderRisk",
    "stateCoverage",
    "routeCompleteness",
    "stylePresetApplication",
  ];
  const overall = Math.round(
    primaryDims.reduce((sum, d) => sum + dimensions[d], 0) / primaryDims.length,
  );

  if (overall < UI_QUALITY_THRESHOLDS.minOverall) issues.push("overall_below_threshold");
  if (appCompliance.score < UI_QUALITY_THRESHOLDS.minAppTypeCompliance) {
    issues.push("app_type_compliance_low");
  }
  if (styleResult.score < UI_QUALITY_THRESHOLDS.minStylePresetScore && input.stylePresetId) {
    issues.push("style_preset_not_applied");
  }
  if (appCompliance.routeCompleteness < UI_QUALITY_THRESHOLDS.minRouteCompleteness && input.routeMap?.length) {
    issues.push("route_completeness_low");
  }
  if (stateCoverage < UI_QUALITY_THRESHOLDS.minStateCoverage) issues.push("state_coverage_low");
  if (placeholderRisk < UI_QUALITY_THRESHOLDS.minPlaceholderRisk) issues.push("placeholder_risk_high");

  for (const dim of primaryDims) {
    if (dim === "routeCompleteness" && !input.routeMap?.length) continue;
    if (dimensions[dim] < UI_QUALITY_THRESHOLDS.minPerDimension) issues.push(`low_${dim}`);
  }

  const needsPolish =
    overall < UI_QUALITY_THRESHOLDS.polishIfBelow ||
    placeholderLike ||
    !passesGateInternal(
      dimensions,
      placeholderLike,
      appCompliance.score,
      styleResult.score,
      input.stylePresetId,
      input.routeMap,
    );

  const passesGate = passesGateInternal(
    dimensions,
    placeholderLike,
    appCompliance.score,
    styleResult.score,
    input.stylePresetId,
    input.routeMap,
  );

  return {
    overall,
    dimensions,
    issues,
    placeholderLike,
    needsPolish,
    appTypeScore: appCompliance.score,
    stylePresetScore: styleResult.score,
    passesGate,
  };
}

function passesGateInternal(
  dimensions: Record<UiQualityDimension, number>,
  placeholderLike: boolean,
  appTypeScore: number,
  stylePresetScore: number,
  stylePresetId?: string | null,
  routeMap?: string[] | null,
): boolean {
  if (placeholderLike) return false;
  const primaryDims: UiQualityDimension[] = [
    "typography",
    "spacing",
    "layoutCompleteness",
    "responsiveReadiness",
    "appRelevance",
    "visualPolish",
    "interactivity",
    "placeholderRisk",
    "stateCoverage",
    "routeCompleteness",
    "stylePresetApplication",
  ];
  const overall = Math.round(
    primaryDims.reduce((sum, d) => sum + dimensions[d], 0) / primaryDims.length,
  );
  if (overall < UI_QUALITY_THRESHOLDS.minOverall) return false;
  if (appTypeScore < UI_QUALITY_THRESHOLDS.minAppTypeCompliance) return false;
  if (dimensions.placeholderRisk < UI_QUALITY_THRESHOLDS.minPlaceholderRisk) return false;
  if (dimensions.stateCoverage < UI_QUALITY_THRESHOLDS.minStateCoverage) return false;
  if (stylePresetId && stylePresetScore < UI_QUALITY_THRESHOLDS.minStylePresetScore) return false;
  if (routeMap?.length && dimensions.routeCompleteness < UI_QUALITY_THRESHOLDS.minRouteCompleteness) {
    return false;
  }
  for (const dim of primaryDims) {
    if (dim === "routeCompleteness" && !routeMap?.length) continue;
    if (dimensions[dim] < UI_QUALITY_THRESHOLDS.minPerDimension) return false;
  }
  return true;
}

/** Blocks generated / preview_ready lifecycle. */
export function uiQualityBlocksGenerated(score: UiQualityScore): boolean {
  return !score.passesGate || score.placeholderLike;
}

export function uiQualityBlocksPublish(score: UiQualityScore): boolean {
  return uiQualityBlocksGenerated(score);
}

export function passesUiQualityGate(input: Parameters<typeof reviewGeneratedUi>[0]): boolean {
  return !uiQualityBlocksGenerated(reviewGeneratedUi(input));
}
