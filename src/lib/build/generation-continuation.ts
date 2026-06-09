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
        "Model generation did not produce a complete app. I'm retrying with a stricter full-app prompt.",
    };
  }
  if (input.meaningfulQualityPasses === false && passIndex < maxPasses && budgetRemainingRatio >= 0.04) {
    return {
      shouldContinue: true,
      passIndex: passIndex + 1,
      reason: "meaningful_quality_below_floor",
      userMessage:
        "Some screens are still incomplete — continuing generation to finish pages and components before preview.",
    };
  }
  if (passIndex >= maxPasses) {
    return {
      shouldContinue: false,
      passIndex,
      reason: "max_passes",
      userMessage: "Build needs another generation pass before preview.",
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
      userMessage: report.passes ? "Build complete" : "Build needs another generation pass before preview.",
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
  opts?: { genericScaffold?: boolean; qualityScore?: number; qualityTarget?: number },
): string {
  if (opts?.genericScaffold) {
    return "Model generation did not produce a complete app. I'm retrying with a stricter full-app prompt.";
  }
  if (weakCount > 0) {
    return `First pass is thin — rewriting ${weakCount} weak file${weakCount === 1 ? "" : "s"} and adding missing routes (not a template).`;
  }
  if (opts?.qualityScore != null && opts?.qualityTarget != null) {
    return `Quality ${opts.qualityScore}/${opts.qualityTarget} — continuing full-app generation with missing routes and components.`;
  }
  return `Continuing generation: adding remaining pages (${report.counts.files} files so far)…`;
}

export const ANTI_GENERIC_SCAFFOLD_FORBID = [
  "FORBIDDEN OUTPUT (instant fail):",
  "- dashboard + records + settings ONLY routes",
  "- MetricCard / PageHeader / EmptyState as the only components",
  "- generic ITEM / STATUS / UPDATED table",
  "- Welcome / Open dashboard copy",
  "- metrics, workflows, team tools placeholder copy",
  "- Loading... / Coming soon / TODO pages",
  "- fewer than minimum files/routes/components",
].join("\n");

export function buildAntiScaffoldContinuationPrompt(input: {
  executionBrief: string;
  planJson: string;
  existingFiles: BuildFile[];
  budget: FullAppGenerationBudget;
  weakFilePaths: string[];
  qualityScore: number;
  qualityTarget: number;
  passIndex: number;
}): string {
  const weakPaths = input.weakFilePaths.slice(0, 16);
  return [
    FILE_PAYLOAD_RULE,
    ANTI_GENERIC_SCAFFOLD_FORBID,
    formatGenerationBudgetForPrompt(input.budget),
    `ANTI-SCAFFOLD RETRY PASS ${input.passIndex + 1}: Previous output matched generic template patterns.`,
    `Quality was ${input.qualityScore}/${input.qualityTarget} — must reach ${input.qualityTarget}+.`,
    `REWRITE (do not keep template): ${weakPaths.join(", ") || "app/page.tsx, app/dashboard/page.tsx"}`,
    "Add app-specific routes, mock data, charts, forms, filters, detail pages, settings.",
    `Brief: ${sliceToTokenBudget(input.executionBrief, 800)}`,
    `Plan: ${sliceToTokenBudget(input.planJson, 500)}`,
    `Return ${input.budget.minFiles}+ meaningful files with ${input.budget.minRoutes}+ feature routes.`,
  ].join("\n");
}