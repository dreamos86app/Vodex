import type { MeaningfulUiQualityReport } from "@/lib/build/meaningful-ui-quality";
import type { GenericScaffoldDetection } from "@/lib/build/generic-scaffold-detector";
import { getHonestModelDisplayName } from "@/lib/ai/model-catalog";
import {
  BUILD_INCOMPLETE_NO_BROKEN_PREVIEW,
  BUILD_NEEDS_ANOTHER_PASS,
  BUILD_PAUSED_HEADLINE,
  CONTINUE_GENERATION_LABEL,
} from "@/lib/build/build-user-copy";

export type BuildFinalSummaryInput = {
  modelId: string;
  durationMs?: number;
  attempts?: number;
  filesGenerated: number;
  filesRewritten: number;
  routes: number;
  components: number;
  meaningfulRoutes: number;
  placeholderWarnings: string[];
  qualityScore: number;
  qualityTarget: number;
  qualityPasses: boolean;
  previewStatus: "ready" | "preparing" | "warning" | "blocked" | "failed" | "not_started";
  logoStatus: string;
  genericScaffold?: GenericScaffoldDetection;
  importGraphStatus?: "pass" | "repaired" | "fail";
  blocker?: string | null;
  nextAction?: string | null;
};

export function formatBuildFinalSummary(input: BuildFinalSummaryInput): string {
  const model = getHonestModelDisplayName(input.modelId);
  const duration =
    typeof input.durationMs === "number"
      ? `${Math.max(1, Math.round(input.durationMs / 1000))}s`
      : "—";
  const warnings =
    input.placeholderWarnings.length > 0
      ? ` · ${input.placeholderWarnings.length} placeholder warning(s)`
      : "";
  const rewrite =
    input.filesRewritten > 0 ? ` · ${input.filesRewritten} rewritten` : "";
  const preview =
    input.previewStatus === "ready"
      ? "Preview live"
      : input.previewStatus === "preparing"
        ? "Preview preparing"
        : input.previewStatus === "warning"
          ? "Preview with quality warning"
          : input.previewStatus === "blocked"
            ? "Preview blocked — quality too low"
            : input.previewStatus === "not_started"
              ? "Preview not started"
              : "Preview needs attention";

  const logo = input.logoStatus.trim() || "Logo status unknown";
  const importLine = input.importGraphStatus
    ? `Import graph: ${input.importGraphStatus}`
    : "";

  if (input.genericScaffold?.isGeneric) {
    const next =
      input.nextAction ??
      "Next action: retry full-app generation with stricter prompt";
    return [
      "Build blocked — generic scaffold detected.",
      `Model: ${model}`,
      `Files: ${input.filesGenerated} draft files`,
      `Meaningful routes: ${input.meaningfulRoutes}/${input.routes}`,
      `Quality: ${input.qualityScore}/${input.qualityTarget}`,
      `Logo: ${logo}`,
      `Preview: not started`,
      importLine,
      next,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (
    input.blocker === "quality_below_floor" ||
    input.blocker === "model_underproduced" ||
    (!input.qualityPasses && input.filesGenerated > 0 && input.filesGenerated < 12)
  ) {
    return [
      BUILD_PAUSED_HEADLINE,
      BUILD_NEEDS_ANOTHER_PASS,
      BUILD_INCOMPLETE_NO_BROKEN_PREVIEW,
      input.nextAction ?? CONTINUE_GENERATION_LABEL,
    ].join("\n");
  }

  if (input.blocker) {
    return [
      `Build blocked — ${input.blocker}`,
      `Model: ${model} · ${duration}`,
      `Files: ${input.filesGenerated} · Quality ${input.qualityScore}/${input.qualityTarget}`,
      `Logo: ${logo} · Preview: ${preview}`,
      importLine,
      input.nextAction ?? "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const attemptsLine =
    typeof input.attempts === "number" && input.attempts > 0
      ? `Attempts: ${input.attempts} · `
      : "";

  if (input.qualityPasses) {
    return `Build complete — ${attemptsLine}${input.filesGenerated} files · ${input.routes} routes · ${input.components} components · ${preview} · ${logo}${rewrite}${warnings}`;
  }

  if (!input.qualityPasses && input.previewStatus === "blocked") {
    return [BUILD_PAUSED_HEADLINE, BUILD_NEEDS_ANOTHER_PASS, CONTINUE_GENERATION_LABEL].join("\n");
  }

  return `Build saved — ${attemptsLine}${input.filesGenerated} files · ${preview} · ${logo}${warnings} · Next: ${input.nextAction ?? "continue generation"}`;
}

export function buildSummaryFromQuality(
  modelId: string,
  meaningful: MeaningfulUiQualityReport,
  extras: Omit<BuildFinalSummaryInput, "qualityScore" | "qualityTarget" | "qualityPasses" | "meaningfulRoutes" | "placeholderWarnings" | "modelId">,
): string {
  return formatBuildFinalSummary({
    modelId,
    qualityScore: meaningful.final_quality_score,
    qualityTarget: meaningful.min_required_score,
    qualityPasses: meaningful.passes,
    meaningfulRoutes: meaningful.meaningful_routes,
    placeholderWarnings: meaningful.warnings,
    ...extras,
  });
}
