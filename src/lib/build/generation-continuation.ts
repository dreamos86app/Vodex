/**
 * Automatic continuation when the model stops before full-app minimums.
 */
import { sliceToTokenBudget } from "@/lib/ai/prompt-compression-policy";
import { FILE_PAYLOAD_RULE } from "@/lib/build/stage-prompts";
import type { FullAppGenerationBudget } from "@/lib/build/full-app-generation-plan";
import { formatGenerationBudgetForPrompt } from "@/lib/build/full-app-generation-plan";
import type { GeneratedAppQualityReport } from "@/lib/build/generated-app-quality-score";
import type { BuildFile } from "@/lib/build/generated-file-utils";

export type ContinuationDecision = {
  shouldContinue: boolean;
  passIndex: number;
  reason: string;
  userMessage: string;
};

export function shouldContinueGeneration(input: {
  report: GeneratedAppQualityReport;
  budget: FullAppGenerationBudget;
  passIndex: number;
  maxPasses: number;
  budgetRemainingRatio: number;
  genericScaffold?: boolean;
  meaningfulQualityPasses?: boolean;
}): ContinuationDecision {
  const { report, budget, passIndex, maxPasses, budgetRemainingRatio } = input;
  if (input.genericScaffold) {
    return {
      shouldContinue: passIndex < maxPasses && budgetRemainingRatio >= 0.06,
      passIndex: passIndex + 1,
      reason: "generic_scaffold_detected",
      userMessage:
        "Generic scaffold detected — expanding with full model generation instead of template output.",
    };
  }
  if (input.meaningfulQualityPasses === false && passIndex < maxPasses && budgetRemainingRatio >= 0.06) {
    return {
      shouldContinue: true,
      passIndex: passIndex + 1,
      reason: "meaningful_quality_below_floor",
      userMessage: `Quality below target (${budget.minQualityScore}+) — continuing full-app generation.`,
    };
  }
  if (passIndex >= maxPasses) {
    return {
      shouldContinue: false,
      passIndex,
      reason: "max_passes",
      userMessage: "Build saved — quality repair needed",
    };
  }
  if (budgetRemainingRatio < 0.06) {
    return {
      shouldContinue: false,
      passIndex,
      reason: "budget_exhausted",
      userMessage: "Build saved — add credits to continue generation",
    };
  }
  if (!report.needsContinuation) {
    return {
      shouldContinue: false,
      passIndex,
      reason: "minimums_met",
      userMessage: report.passes ? "Build complete" : "Build saved — quality repair needed",
    };
  }
  return {
    shouldContinue: true,
    passIndex: passIndex + 1,
    reason: report.failures.slice(0, 3).join(",") || "below_minimums",
    userMessage: `Continuing generation: adding remaining pages (${report.counts.files}/${budget.minFiles} target files)`,
  };
}

export function buildContinuationFrontendPrompt(input: {
  executionBrief: string;
  planJson: string;
  existingFiles: BuildFile[];
  budget: FullAppGenerationBudget;
  report: GeneratedAppQualityReport;
  passIndex: number;
  weakFilePaths?: string[];
}): string {
  const existingPaths = input.existingFiles.map((f) => f.path).slice(0, 40);
  const missingRoutes = input.report.routeConnectivity.orphanRoutes.slice(0, 8);
  const weakPaths = (input.weakFilePaths ?? []).slice(0, 12);
  const brief = sliceToTokenBudget(input.executionBrief, 700);

  return [
    FILE_PAYLOAD_RULE,
    formatGenerationBudgetForPrompt(input.budget),
    `CONTINUATION PASS ${input.passIndex + 1}: First pass is thin — expand the real UI, not replace your app.`,
    `Current gaps: ${input.report.failures.join(", ") || "expand routes and components"}.`,
    weakPaths.length
      ? `REWRITE these weak/shallow files with app-specific depth (mark as file_rewritten): ${weakPaths.join(", ")}`
      : "Rewrite app/page.tsx and dashboard routes if they are welcome-only or generic tables.",
    `Preserve strong files — only improve weak ones. Strong paths: ${existingPaths.slice(0, 20).join(", ")}`,
    missingRoutes.length
      ? `Wire navigation to orphan routes: ${missingRoutes.join(", ")}`
      : "Add missing feature routes and link them from AppShell navigation.",
    "Each page: KPI cards, tables with data, filters, detail sections, empty states — app-specific copy only.",
    `Brief: ${brief}`,
    `Plan: ${sliceToTokenBudget(input.planJson, 400)}`,
    `Target at least ${input.budget.minFiles} meaningful files and ${input.budget.minRoutes} rich routes.`,
  ].join("\n");
}

export function continuationUserMessage(
  report: GeneratedAppQualityReport,
  weakCount: number,
): string {
  if (weakCount > 0) {
    return `First pass is thin — expanding the real UI across ${weakCount} weak file${weakCount === 1 ? "" : "s"}, not replacing your app.`;
  }
  return `Continuing generation: adding remaining pages (${report.counts.files} files so far)…`;
}