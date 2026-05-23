import { FULL_BUILD_CAP_USD } from "@/lib/ai/cost-budget";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";

export type ModelEscalationReason =
  | "none"
  | "ambiguous_intent"
  | "complex_production_app"
  | "security_backend_required"
  | "repeated_validation_failure"
  | "ui_polish_patch_needed"
  | "user_requested_premium";

export type OperationBudgetEntry = {
  operation: string;
  stage: string;
  modelId: string;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheHit: boolean;
  escalationReason: ModelEscalationReason;
  userCreditsCharged?: number;
  grossMargin?: number;
  blocked?: boolean;
  blockReason?: string;
};

export type OperationBudgetSummary = {
  entries: OperationBudgetEntry[];
  accumulatedProviderUsd: number;
  cacheHits: number;
  cacheMisses: number;
  escalations: ModelEscalationReason[];
  providerCapUsd: number;
  withinCap: boolean;
  totalCreditsCharged: number;
  estimatedGrossMargin: number;
};

/** Per-build operation budget tracker — records cost, cache, escalation for audit. */
export class OperationBudgetTracker {
  private entries: OperationBudgetEntry[] = [];
  private accumulatedUsd = 0;

  constructor(private readonly providerCapUsd = FULL_BUILD_CAP_USD) {}

  record(input: {
    operation: string;
    stage: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cacheHit?: boolean;
    escalationReason?: ModelEscalationReason;
    userCreditsCharged?: number;
    actualCostUsd?: number;
  }): OperationBudgetEntry {
    const estimated = estimateTokenProviderCostUsd(
      input.modelId,
      input.inputTokens,
      input.outputTokens,
    );
    const actual = input.actualCostUsd ?? estimated;
    const credits = input.userCreditsCharged ?? 0;
    const grossMargin = credits > 0 ? (credits - actual) / credits : 0;

    const blocked = this.accumulatedUsd + actual > this.providerCapUsd;
    const entry: OperationBudgetEntry = {
      operation: input.operation,
      stage: input.stage,
      modelId: input.modelId,
      estimatedCostUsd: estimated,
      actualCostUsd: actual,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheHit: input.cacheHit ?? false,
      escalationReason: input.escalationReason ?? "none",
      userCreditsCharged: credits,
      grossMargin,
      blocked,
      blockReason: blocked ? "provider_cap_exceeded" : undefined,
    };
    this.entries.push(entry);
    if (!blocked) this.accumulatedUsd += actual;
    return entry;
  }

  canProceed(estimatedUsd: number): { allowed: boolean; reason?: string } {
    if (this.accumulatedUsd + estimatedUsd > this.providerCapUsd) {
      return { allowed: false, reason: "provider_cap_exceeded" };
    }
    return { allowed: true };
  }

  summary(): OperationBudgetSummary {
    const cacheHits = this.entries.filter((e) => e.cacheHit).length;
    const escalations = [
      ...new Set(
        this.entries
          .map((e) => e.escalationReason)
          .filter((r): r is ModelEscalationReason => r !== "none"),
      ),
    ];
    const totalCredits = this.entries.reduce((s, e) => s + (e.userCreditsCharged ?? 0), 0);
    const totalCost = this.entries.reduce((s, e) => s + (e.actualCostUsd ?? e.estimatedCostUsd), 0);
    const margin = totalCredits > 0 ? (totalCredits - totalCost) / totalCredits : 0;

    return {
      entries: [...this.entries],
      accumulatedProviderUsd: this.accumulatedUsd,
      cacheHits,
      cacheMisses: this.entries.length - cacheHits,
      escalations,
      providerCapUsd: this.providerCapUsd,
      withinCap: this.accumulatedUsd <= this.providerCapUsd,
      totalCreditsCharged: totalCredits,
      estimatedGrossMargin: margin,
    };
  }
}
