import { reviewGeneratedUi, type UiQualityScore } from "@/lib/generation/generated-ui-review";
import {
  buildFullUiGenerationBlock,
  UI_QUALITY_THRESHOLDS,
  type UiGenerationContext,
} from "@/lib/generation/ui-quality-spec";
import { appTypePromptBlock } from "@/lib/generation/app-type-ui-requirements";

export type UiPolishPlan = {
  needsPolish: boolean;
  promptAddendum: string;
  scoreBefore: UiQualityScore;
  estimatedCredits: number;
  includedInReservation: boolean;
  quoted: boolean;
};

/** Production tier includes one polish pass in the build reservation. */
export function polishIncludedInReservation(buildTier?: string | null): boolean {
  return buildTier === "production";
}

/** Quote polish credits from UI gap — never silent spend. */
export function quoteUiPolishCredits(input: {
  fileCount: number;
  scoreBefore: UiQualityScore;
}): number {
  if (!input.scoreBefore.needsPolish) return 0;
  const gap = Math.max(0, UI_QUALITY_THRESHOLDS.minOverall - input.scoreBefore.overall);
  const placeholderPenalty = input.scoreBefore.placeholderLike ? 4 : 0;
  const fileFactor = Math.ceil(input.fileCount / 5);
  return Math.min(20, Math.max(4, Math.ceil(gap / 4) + fileFactor + placeholderPenalty));
}

/** Build polish prompt addendum when UI score is below threshold. User sees credits before spend. */
export function planUiPolishPass(input: {
  files: Array<{ path: string; content: string }>;
  ctx: UiGenerationContext;
  buildTier?: string | null;
  reservationCoversPolish?: boolean;
}): UiPolishPlan {
  const scoreBefore = reviewGeneratedUi({
    files: input.files,
    appType: input.ctx.appType,
    stylePresetId: input.ctx.stylePresetId,
    routeMap: input.ctx.routeMap,
  });

  const includedInReservation =
    input.reservationCoversPolish ?? polishIncludedInReservation(input.buildTier);
  const estimatedCredits = includedInReservation ? 0 : quoteUiPolishCredits({
    fileCount: input.files.length,
    scoreBefore,
  });

  const promptAddendum = [
    "POLISH PASS — improve UI quality without changing core features.",
    includedInReservation
      ? "Included in your production build reservation — no extra credit charge."
      : `Estimated polish credits: ${estimatedCredits} — confirm before this runs.`,
    buildFullUiGenerationBlock(input.ctx),
    appTypePromptBlock(input.ctx.appType),
    scoreBefore.issues.length ? `Fix these review issues: ${scoreBefore.issues.join(", ")}` : "",
    `Current scores — overall: ${scoreBefore.overall}, app-type: ${scoreBefore.appTypeScore}, style: ${scoreBefore.stylePresetScore}, placeholder risk: ${scoreBefore.dimensions.placeholderRisk}`,
    "Raise typography, spacing, responsive layout, state coverage, and app-specific sections.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    needsPolish: scoreBefore.needsPolish,
    promptAddendum,
    scoreBefore,
    estimatedCredits,
    includedInReservation,
    quoted: !includedInReservation && scoreBefore.needsPolish,
  };
}

export { reviewGeneratedUi, passesUiQualityGate } from "@/lib/generation/generated-ui-review";
