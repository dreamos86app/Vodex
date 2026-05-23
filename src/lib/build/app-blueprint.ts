import { buildDeterministicBlueprint } from "@/lib/build/blueprint-deterministic";
import { enrichBlueprintWithLlm } from "@/lib/build/blueprint-enrich";
import {
  parseAppBlueprint,
  requiresBlueprintApproval,
  sanitizeBlueprintForUser,
  type AppBlueprint,
  type BlueprintQualityLevel,
} from "@/lib/build/blueprint-schema";

export type { AppBlueprint, BlueprintQualityLevel };
export { parseAppBlueprint, requiresBlueprintApproval, sanitizeBlueprintForUser };

export type BlueprintBuildInput = {
  prompt: string;
  templateId?: string | null;
  stylePresetId?: string | null;
  modelId?: string;
  qualityLevel?: BlueprintQualityLevel;
  mode?: "deterministic_quick" | "llm_enriched" | "template_assisted";
  userId?: string;
  userEmail?: string | null;
  projectId?: string | null;
  operationId?: string;
  existingFiles?: Array<{ path: string; content: string }>;
};

export type BlueprintBuildResult = {
  blueprint: AppBlueprint;
  providerCostUsd: number;
};

export async function buildAppBlueprint(input: BlueprintBuildInput): Promise<BlueprintBuildResult> {
  const quality = input.qualityLevel ?? "standard";
  const useLlm =
    input.mode === "llm_enriched" ||
    (quality !== "quick" && Boolean(input.userId && input.operationId));

  if (useLlm && input.userId && input.operationId) {
    const enriched = await enrichBlueprintWithLlm({
      prompt: input.prompt,
      templateId: input.templateId,
      modelId: input.modelId,
      qualityLevel: quality,
      userId: input.userId,
      userEmail: input.userEmail,
      projectId: input.projectId,
      operationId: input.operationId,
      existingFiles: input.existingFiles,
    });
    if ("error" in enriched) {
      return {
        blueprint: buildDeterministicBlueprint({
          prompt: input.prompt,
          templateId: input.templateId,
          stylePresetId: input.stylePresetId,
          modelId: input.modelId,
          qualityLevel: quality,
        }),
        providerCostUsd: 0,
      };
    }
    return enriched;
  }

  return {
    blueprint: buildDeterministicBlueprint({
      prompt: input.prompt,
      templateId: input.templateId,
      stylePresetId: input.stylePresetId,
      modelId: input.modelId,
      qualityLevel: quality,
    }),
    providerCostUsd: 0,
  };
}

export function validateBlueprintJson(raw: unknown) {
  return parseAppBlueprint(raw);
}
