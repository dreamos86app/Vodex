import type { MeaningfulUiQualityReport } from "@/lib/build/meaningful-ui-quality";
import type { GenericScaffoldDetection } from "@/lib/build/generic-scaffold-detector";
import { getHonestModelDisplayName } from "@/lib/ai/model-catalog";

export type BuildFinalSummaryInput = {
  modelId: string;
  durationMs?: number;
  filesGenerated: number;
  filesRewritten: number;
  routes: number;
  components: number;
  meaningfulRoutes: number;
  placeholderWarnings: string[];
  qualityScore: number;
  qualityTarget: number;
  qualityPasses: boolean;
  previewStatus: "ready" | "preparing" | "warning" | "blocked" | "failed";
  logoStatus: string;
  genericScaffold?: GenericScaffoldDetection;
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
            : "Preview needs attention";

  const logo = input.logoStatus.trim() || "Logo status unknown";

  if (input.genericScaffold?.isGeneric) {
    return [
      "Build blocked — generic scaffold detected, not a real model UI.",
      `${input.filesGenerated} files · ${input.meaningfulRoutes}/${input.routes} meaningful routes · Quality ${input.qualityScore}/${input.qualityTarget}`,
      `Model: ${model} · ${duration} · ${logo}`,
    ].join(" ");
  }

  if (input.qualityPasses) {
    return `Build saved — ${input.filesGenerated} files · ${input.routes} routes · ${input.components} components · Quality ${input.qualityScore}/${input.qualityTarget} · ${preview} · ${logo}${rewrite}${warnings}`;
  }

  return `Build saved — continuing generation needed · ${input.filesGenerated} files · ${input.meaningfulRoutes} meaningful routes · Quality ${input.qualityScore}/${input.qualityTarget} · Model ${model} · ${duration} · ${logo}${warnings}`;
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
