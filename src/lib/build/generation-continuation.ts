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
}): ContinuationDecision {
  const { report, budget, passIndex, maxPasses, budgetRemainingRatio } = input;
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
}): string {
  const existingPaths = input.existingFiles.map((f) => f.path).slice(0, 40);
  const missingRoutes = input.report.routeConnectivity.orphanRoutes.slice(0, 8);
  const brief = sliceToTokenBudget(input.executionBrief, 700);

  return [
    FILE_PAYLOAD_RULE,
    formatGenerationBudgetForPrompt(input.budget),
    `CONTINUATION PASS ${input.passIndex + 1}: Do NOT shrink or replace existing files.`,
    `Current gaps: ${input.report.failures.join(", ") || "expand routes and components"}.`,
    `Existing files (${existingPaths.length}): ${existingPaths.join(", ")}`,
    missingRoutes.length
      ? `Wire navigation to orphan routes: ${missingRoutes.join(", ")}`
      : "Add missing feature routes and link them from AppShell navigation.",
    "Generate ONLY new files and updates to navigation/layout — app-specific UI, no generic shell.",
    `Brief: ${brief}`,
    `Plan: ${sliceToTokenBudget(input.planJson, 400)}`,
    `Return additional files until at least ${input.budget.minFiles} meaningful files and ${input.budget.minRoutes} routes exist.`,
  ].join("\n");
}

/** Fix typo in shouldContinueGeneration - I used report.report which is wrong. Let me fix generation-continuation.ts */