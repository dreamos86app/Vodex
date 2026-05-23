import type { BuildTier } from "@/components/create/create-build-confirm-step";
import type { BlueprintQualityLevel } from "@/lib/build/blueprint-schema";
import type { CreateFlowState } from "@/lib/create/create-flow-state";

export type CreateFlowConfig = {
  templateId: string | null;
  stylePresetId: string | null;
  buildTier: BuildTier;
  userPrompt: string;
  createFlowState: CreateFlowState | null;
};

export const DEFAULT_CREATE_FLOW_CONFIG: CreateFlowConfig = {
  templateId: null,
  stylePresetId: "minimal",
  buildTier: "standard",
  userPrompt: "",
  createFlowState: null,
};

export function buildTierToQualityLevel(tier: BuildTier): BlueprintQualityLevel {
  if (tier === "quick") return "quick";
  if (tier === "production") return "production";
  return "standard";
}

export function qualityLevelToBudgetMode(tier: BuildTier): "economy" | "balanced" | "premium" {
  if (tier === "quick") return "economy";
  if (tier === "production") return "premium";
  return "balanced";
}

export function readCreateFlowConfig(metadata: unknown): CreateFlowConfig {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...DEFAULT_CREATE_FLOW_CONFIG };
  }
  const m = metadata as Record<string, unknown>;
  const tier = m.build_tier;
  const buildTier: BuildTier =
    tier === "quick" || tier === "production" || tier === "standard" ? tier : "standard";
  const state = m.create_flow_state;
  return {
    templateId: typeof m.template_id === "string" ? m.template_id : null,
    stylePresetId:
      typeof m.style_preset_id === "string" ? m.style_preset_id : DEFAULT_CREATE_FLOW_CONFIG.stylePresetId,
    buildTier,
    userPrompt: typeof m.initial_prompt === "string" ? m.initial_prompt : "",
    createFlowState:
      typeof state === "string" ? (state as CreateFlowState) : null,
  };
}

export function createFlowConfigPatch(config: Partial<CreateFlowConfig>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (config.templateId !== undefined) patch.template_id = config.templateId;
  if (config.stylePresetId !== undefined) patch.style_preset_id = config.stylePresetId;
  if (config.buildTier !== undefined) patch.build_tier = config.buildTier;
  if (config.userPrompt !== undefined) patch.initial_prompt = config.userPrompt;
  if (config.createFlowState !== undefined) patch.create_flow_state = config.createFlowState;
  return patch;
}
