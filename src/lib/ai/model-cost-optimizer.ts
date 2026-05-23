import type { GenerationMode } from "@/lib/billing/pricing-config";
import type { CreateIntent } from "@/lib/intent/create-intent-classifier";
import type { ModelEscalationReason } from "@/lib/ai/operation-budget-tracker";

export type StageModelPlan = {
  stage: string;
  modelId: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  useCache: boolean;
  compressContext: boolean;
  escalationReason?: ModelEscalationReason;
};

export type CostOptimizerInput = {
  intent?: CreateIntent;
  mode: GenerationMode;
  complexity?: number;
  userCreditsBalance?: number;
  reservedCredits?: number;
  qualityLevel?: "quick" | "standard" | "production" | "premium";
  /** DB, auth, billing, or security-heavy build stages */
  requiresBackendSecurity?: boolean;
  /** Prior validation/repair attempts failed */
  validationFailureCount?: number;
  /** Intent classifier could not resolve deterministically */
  intentAmbiguous?: boolean;
};

const MINI = "gpt-4o-mini";
const UI_STRONG = "claude-sonnet";
const UI_COST_EFFECTIVE = "gemini-flash";

export function planStageModels(input: CostOptimizerInput): {
  stages: StageModelPlan[];
  recommendCheaperMode: boolean;
  recommendPremium: boolean;
  userNote: string;
  silentDowngrade: false;
} {
  const complexity = input.complexity ?? 5;
  const balance = input.userCreditsBalance ?? 999;
  const reserved = input.reservedCredits ?? 0;
  const recommendCheaperMode = balance < reserved || balance < 15;
  const recommendPremium = balance >= 50 && complexity >= 7 && !recommendCheaperMode;

  if (input.intent === "question_only" || input.intent === "pricing_question") {
    return {
      stages: [
        {
          stage: "intent",
          modelId: MINI,
          maxInputTokens: 2000,
          maxOutputTokens: 400,
          useCache: true,
          compressContext: true,
        },
      ],
      recommendCheaperMode: false,
      recommendPremium: false,
      userNote: "Answer only — no build models used.",
      silentDowngrade: false,
    };
  }

  const intentModel = input.intentAmbiguous ? MINI : MINI;
  const intentEscalation: ModelEscalationReason = input.intentAmbiguous ? "ambiguous_intent" : "none";

  const blueprintEscalation: ModelEscalationReason =
    complexity >= 8 || input.qualityLevel === "premium" || input.qualityLevel === "production"
      ? complexity >= 8 || input.qualityLevel === "premium"
        ? "complex_production_app"
        : "none"
      : "none";
  const blueprintModel =
    complexity >= 8 || input.qualityLevel === "premium" ? UI_STRONG : MINI;

  const uiEscalation: ModelEscalationReason =
    complexity >= 7 || input.qualityLevel === "premium" ? "complex_production_app" : "none";
  const uiModel = complexity >= 7 || input.qualityLevel === "premium" ? UI_STRONG : UI_COST_EFFECTIVE;

  const backendEscalation: ModelEscalationReason = input.requiresBackendSecurity
    ? "security_backend_required"
    : "none";
  const backendModel =
    input.requiresBackendSecurity || complexity >= 8 ? UI_STRONG : MINI;

  const validationEscalation: ModelEscalationReason =
    (input.validationFailureCount ?? 0) >= 2 ? "repeated_validation_failure" : "none";
  const validationModel =
    (input.validationFailureCount ?? 0) >= 2 ? UI_STRONG : MINI;

  const polishDiagnosisModel = MINI;
  const polishPatchModel =
    (input.validationFailureCount ?? 0) >= 1 || complexity >= 6 ? UI_STRONG : MINI;
  const polishEscalation: ModelEscalationReason =
    polishPatchModel !== MINI ? "ui_polish_patch_needed" : "none";

  const stages: StageModelPlan[] = [
    {
      stage: "intent",
      modelId: intentModel,
      maxInputTokens: 1500,
      maxOutputTokens: 200,
      useCache: true,
      compressContext: true,
      escalationReason: intentEscalation,
    },
    {
      stage: "prompt_normalization",
      modelId: MINI,
      maxInputTokens: 3000,
      maxOutputTokens: 400,
      useCache: true,
      compressContext: true,
    },
    {
      stage: "blueprint",
      modelId: blueprintModel,
      maxInputTokens: 6000,
      maxOutputTokens: 900,
      useCache: true,
      compressContext: true,
      escalationReason: blueprintEscalation,
    },
    {
      stage: "file_plan",
      modelId: MINI,
      maxInputTokens: 4000,
      maxOutputTokens: 600,
      useCache: true,
      compressContext: true,
    },
    {
      stage: "ui_generation",
      modelId: uiModel,
      maxInputTokens: 12000,
      maxOutputTokens: 900,
      useCache: false,
      compressContext: true,
      escalationReason: uiEscalation,
    },
    {
      stage: "backend_generation",
      modelId: backendModel,
      maxInputTokens: 8000,
      maxOutputTokens: 900,
      useCache: false,
      compressContext: true,
      escalationReason: backendEscalation,
    },
    {
      stage: "validation",
      modelId: validationModel,
      maxInputTokens: 2000,
      maxOutputTokens: 300,
      useCache: false,
      compressContext: true,
      escalationReason: validationEscalation,
    },
    {
      stage: "polish_diagnosis",
      modelId: polishDiagnosisModel,
      maxInputTokens: 4000,
      maxOutputTokens: 400,
      useCache: false,
      compressContext: true,
    },
    {
      stage: "polish_patch",
      modelId: polishPatchModel,
      maxInputTokens: 6000,
      maxOutputTokens: 900,
      useCache: false,
      compressContext: true,
      escalationReason: polishEscalation,
    },
    {
      stage: "repair",
      modelId: validationModel,
      maxInputTokens: 4000,
      maxOutputTokens: 600,
      useCache: false,
      compressContext: true,
      escalationReason: validationEscalation,
    },
  ];

  const premiumNote = recommendPremium
    ? " Premium quality available — stronger UI model with reserved credits."
    : "";
  const cheaperNote = recommendCheaperMode
    ? "Low credits — cheaper mode recommended. Unused reserved credits are returned."
    : "Estimated credits shown before run. Strong models used only for UI and security-heavy stages.";

  return {
    stages,
    recommendCheaperMode,
    recommendPremium,
    userNote: cheaperNote + premiumNote,
    silentDowngrade: false,
  };
}

/** Recommend cheaper generation mode when balance is low — never silent. */
export function recommendCheaperMode(balance: number, reserved: number): {
  recommend: boolean;
  message: string;
} {
  if (balance < reserved || balance < 15) {
    return {
      recommend: true,
      message: "Insufficient credits for full build — switch to quick mode or add credits.",
    };
  }
  return { recommend: false, message: "" };
}
