/**
 * Vodex — Cost-first deterministic model router.
 * All provider calls must use routeOperation() — never pick Sonnet/Opus ad-hoc.
 */
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { hasAnyLlmProviderKey } from "@/lib/llm/env-keys";
import type { AiOperationType, ModelTier, RoutedModelSpec } from "@/lib/ai/operation-types";
import {
  isGrokConfigured,
  pickStandardFast,
  providerForCatalogId,
  toApiModelId,
} from "@/lib/ai/model-catalog";
import { maxBudgetForOperation } from "@/lib/ai/cost-budget";
import {
  isAutomaticModelId,
  pickAutomaticImplementationModelId,
} from "@/lib/ai/resolve-automatic-model";
import {
  ensureUiImplementationModelId,
  isUiBuildCapableModelId,
  pickUiImplementationModelId,
} from "@/lib/ai/ui-implementation-model";

export type { AiOperationType, ModelTier, RoutedModelSpec } from "@/lib/ai/operation-types";

export type AiTaskMode =
  | "discuss"
  | "edit"
  | "build"
  | "design"
  | "code"
  | "polish"
  | "image"
  | "planning";

export type ModelRouteResult = {
  mode: AiTaskMode;
  provider: "anthropic" | "openai" | "google" | "unknown";
  modelId: string;
  estimatedTier: "fast" | "standard" | "premium";
  isFallback: boolean;
  missingEnv: string[];
  routeReason: string;
};

export type RouteOperationContext = {
  operationType: AiOperationType;
  complexity?: number;
  ownerEmail?: string | null;
  enableUltraModels?: boolean;
  requestedModelId?: string | null;
};

const ULTRA_OPS = new Set<AiOperationType>([
  "deep_architecture_review",
  "massive_context_review",
  "emergency_hard_repair",
]);

function spec(
  operationType: AiOperationType,
  modelId: string,
  maxOutputTokens: number,
  opts: Partial<RoutedModelSpec> = {},
  complexity?: number,
): RoutedModelSpec {
  const apiModelId = toApiModelId(modelId);
  return {
    operationType,
    tier: opts.tier ?? "standard_fast",
    provider: providerForCatalogId(modelId),
    modelId,
    apiModelId,
    maxOutputTokens,
    maxInputTokens: opts.maxInputTokens ?? 4000,
    temperature: opts.temperature ?? 0,
    strictJson: opts.strictJson ?? false,
    maxProviderCostUsd:
      opts.maxProviderCostUsd ?? maxBudgetForOperation(operationType, complexity),
    routeReason: opts.routeReason ?? operationType,
    comingSoon: opts.comingSoon,
    ...opts,
  };
}

function canUseUltra(ctx: RouteOperationContext): boolean {
  if (!ULTRA_OPS.has(ctx.operationType)) return false;
  const owner = isDreamosOwnerEmail(ctx.ownerEmail);
  return owner && Boolean(ctx.enableUltraModels);
}

function implementationModel(
  complexity: number,
  ownerEmail?: string | null,
): { id: string; tier: ModelTier } {
  const id = pickUiImplementationModelId(complexity, ownerEmail);
  if (id.includes("opus") || id.includes("gpt-5-5") || id.includes("3-1-pro")) {
    return { id, tier: "premium_implementation" };
  }
  if (id.includes("sonnet") || id.includes("gpt-5-4") || id.includes("2-5-pro")) {
    return { id, tier: "premium_implementation" };
  }
  return { id, tier: "standard_fast" };
}

function userSelectedSpec(
  operationType: AiOperationType,
  modelId: string,
  complexity?: number,
): RoutedModelSpec | null {
  const normalized = modelId.trim().toLowerCase();
  if (normalized === "grok-4" && !isGrokConfigured()) return null;

  const tier: ModelTier =
    normalized.includes("opus") || normalized.includes("gpt-5-5")
      ? "ultra_owner_only"
      : normalized.includes("sonnet") || normalized.includes("gpt-5-4")
        ? "premium_implementation"
        : "standard_fast";

  const maxOut =
    operationType.includes("implementation") ||
    operationType === "edit_patch_hard" ||
    operationType === "code_repair_hard"
      ? implementationMaxOut(
          operationType === "backend_implementation" ? "backend_implementation" : "frontend_implementation",
          complexity ?? 5,
        )
      : operationType.startsWith("discuss")
        ? 700
        : operationType === "code_repair_small"
          ? 1800
          : 1200;

  return spec(operationType, modelId, maxOut, {
    tier,
    routeReason: "user_selected_model",
    temperature: operationType.includes("discuss") ? 0.3 : 0.2,
  }, complexity);
}

function implementationMaxOut(op: "frontend_implementation" | "backend_implementation", complexity: number): number {
  if (op === "frontend_implementation") {
    if (complexity <= 4) return 5000;
    if (complexity <= 7) return 8000;
    return 12_000;
  }
  if (complexity <= 4) return 3500;
  if (complexity <= 7) return 5500;
  return 8000;
}

/** Primary router — use for every AI operation. */
export function routeOperation(ctx: RouteOperationContext): RoutedModelSpec {
  const complexity = Math.min(10, Math.max(1, ctx.complexity ?? 5));

  if (!hasAnyLlmProviderKey()) {
    return spec(ctx.operationType, "gpt-5.4-mini", 500, {
      routeReason: "no_provider_keys",
      provider: "none",
    });
  }

  if (canUseUltra(ctx)) {
    return spec(ctx.operationType, "claude-opus-4.7", 4000, {
      tier: "ultra_owner_only",
      routeReason: "owner_ultra_approved",
      maxProviderCostUsd: 1.0,
    });
  }

  if (ctx.requestedModelId && !isAutomaticModelId(ctx.requestedModelId)) {
    const ultraIds = ["claude-opus-4.7", "claude-opus-4-6", "gpt-5.5", "gpt-5.4", "gemini-3.1-pro"];
    let requested = ctx.requestedModelId;
    if (ultraIds.includes(requested) && !isDreamosOwnerEmail(ctx.ownerEmail)) {
      requested = pickUiImplementationModelId(complexity, ctx.ownerEmail);
    }
    if (
      (ctx.operationType === "frontend_implementation" ||
        ctx.operationType === "backend_implementation" ||
        ctx.operationType === "code_repair_hard") &&
      !isUiBuildCapableModelId(requested)
    ) {
      requested = ensureUiImplementationModelId(null, complexity, ctx.ownerEmail);
    }
    const selected = userSelectedSpec(ctx.operationType, requested, complexity);
    if (selected) return selected;
  }

  const op = ctx.operationType;

  switch (op) {
    case "classify_intent":
      return spec(op, pickStandardFast("google"), 250, { strictJson: true, temperature: 0 });
    case "normalize_prompt":
      return spec(op, pickStandardFast("google"), 300, { strictJson: true, temperature: 0 });
    case "safety_scope_check":
      return spec(op, pickStandardFast("openai"), 300, { strictJson: true, temperature: 0 });
    case "discuss_short":
    case "discuss_stream":
      return spec(op, pickStandardFast("openai"), 700, { temperature: 0.3 });
    case "discuss_deep":
      return spec(op, pickStandardFast("openai"), 1200, { temperature: 0.3 });
    case "build_intake":
      return spec(op, pickStandardFast("google"), 600, { strictJson: true, temperature: 0 });
    case "build_plan":
      return spec(op, pickStandardFast("openai"), 1200, { strictJson: true, temperature: 0 });
    case "app_identity":
      return spec(op, "claude-haiku-4.5", 600, { strictJson: true, temperature: 0 });
    case "icon_svg_generation":
      return spec(op, pickStandardFast("openai"), 900, { strictJson: true, temperature: 0 });
    case "schema_design":
      return spec(op, pickStandardFast("openai"), 1300, { strictJson: true, temperature: 0 });
    case "ui_design_plan":
      return spec(op, pickStandardFast("openai"), 1500, { strictJson: true, temperature: 0 });
    case "frontend_implementation": {
      const m = implementationModel(complexity, ctx.ownerEmail);
      return spec(
        op,
        m.id,
        implementationMaxOut(op, complexity),
        {
          tier: m.tier,
          strictJson: true,
          temperature: 0.1,
          routeReason: "automatic_frontend_implementation",
        },
        complexity,
      );
    }
    case "backend_implementation": {
      const m = implementationModel(complexity, ctx.ownerEmail);
      return spec(
        op,
        m.id,
        implementationMaxOut(op, complexity),
        { tier: m.tier, temperature: 0.2, routeReason: "automatic_implementation" },
        complexity,
      );
    }
    case "integration_stub":
      return spec(op, pickStandardFast("openai"), 1200, { strictJson: true, temperature: 0 });
    case "file_validation":
      return spec(op, pickStandardFast("google"), 700, { strictJson: true, temperature: 0 });
    case "preview_validation":
      return spec(op, "gemini-flash", 700, { strictJson: true, temperature: 0 });
    case "code_repair_small":
      return spec(op, "claude-haiku-4.5", 1800, { temperature: 0.1 });
    case "code_repair_hard":
      return spec(op, pickUiImplementationModelId(Math.max(7, complexity), ctx.ownerEmail), 4500, {
        tier: "premium_implementation",
        temperature: 0.1,
      });
    case "diagnostics_summary":
      return spec(op, "gemini-flash", 600, { temperature: 0 });
    case "publish_readiness":
      return spec(op, "gemini-flash", 400, { strictJson: true, temperature: 0 });
    case "admin_debug_summary":
      return spec(op, pickStandardFast("openai"), 600, { temperature: 0 });
    case "edit_target_detection":
      return spec(op, pickStandardFast("google"), 500, { strictJson: true, temperature: 0 });
    case "edit_patch_small":
    case "edit_stream":
      return spec(op, pickStandardFast("openai"), 1700, { temperature: 0.2 });
    case "edit_patch_hard":
      return spec(op, pickUiImplementationModelId(Math.max(7, complexity), ctx.ownerEmail), 2200, {
        tier: "premium_implementation",
        temperature: 0.2,
      });
    default:
      return spec(op, pickStandardFast("openai"), 800, { temperature: 0.2 });
  }
}

/** Down-route when budget exceeded */
export function downRouteOperation(
  current: RoutedModelSpec,
  complexity?: number,
): RoutedModelSpec | null {
  if (current.tier === "standard_fast") return null;
  const cheaper = routeOperation({
    operationType: current.operationType,
    complexity: complexity ?? 5,
  });
  if (cheaper.modelId === current.modelId) {
    return {
      ...cheaper,
      maxOutputTokens: Math.floor(current.maxOutputTokens * 0.7),
      routeReason: `${cheaper.routeReason}; down_routed_tokens`,
    };
  }
  return cheaper;
}

export { isAutomaticModelId } from "@/lib/ai/resolve-automatic-model";

export function mapChatModeToTask(mode: "discuss" | "edit" | "build"): AiTaskMode {
  if (mode === "build") return "build";
  if (mode === "edit") return "edit";
  return "discuss";
}

export function routeModel(
  mode: AiTaskMode,
  requestedModelId?: string | null,
  ctx?: { ownerEmail?: string | null; deep?: boolean },
): ModelRouteResult {
  if (requestedModelId === "grok-4" && !isGrokConfigured()) {
    requestedModelId = "automatic";
  }

  const op: AiOperationType =
    mode === "discuss"
      ? ctx?.deep
        ? "discuss_deep"
        : "discuss_stream"
      : mode === "edit"
        ? "edit_stream"
        : "build_plan";

  const routed = routeOperation({
    operationType: op,
    requestedModelId: isAutomaticModelId(requestedModelId) ? undefined : requestedModelId,
    ownerEmail: ctx?.ownerEmail,
    complexity: 5,
  });

  const automatic = isAutomaticModelId(requestedModelId);

  return {
    mode,
    provider: routed.provider === "none" ? "unknown" : routed.provider,
    modelId: automatic ? "automatic" : routed.modelId,
    estimatedTier:
      routed.tier === "standard_fast"
        ? "fast"
        : routed.tier === "premium_implementation"
          ? "premium"
          : "premium",
    isFallback: false,
    missingEnv: [],
    routeReason: routed.routeReason,
  };
}
