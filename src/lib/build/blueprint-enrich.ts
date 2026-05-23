import { parseJsonFromModel } from "@/lib/ai/provider-call";
import { callProviderStructured } from "@/lib/ai/provider-call";
import type { AppBlueprint, BlueprintQualityLevel } from "@/lib/build/blueprint-schema";
import { parseAppBlueprint, validateBlueprintContent } from "@/lib/build/blueprint-schema";
import { buildDeterministicBlueprint } from "@/lib/build/blueprint-deterministic";
import { compressProjectContext } from "@/lib/ai/prompt-compressor";

export type EnrichBlueprintInput = {
  prompt: string;
  templateId?: string | null;
  modelId?: string;
  qualityLevel: BlueprintQualityLevel;
  projectContext?: string;
  existingFiles?: Array<{ path: string; content: string }>;
  userId: string;
  userEmail?: string | null;
  projectId?: string | null;
  operationId: string;
};

const BLUEPRINT_SYSTEM = `You are DreamOS86 blueprint architect. Output strict JSON only matching the requested schema.
Never include secrets, API keys, service role keys, or internal model names.
Never claim the app is already deployed.
Use canonical Supabase project wciioegiczwqlmlroley only in env examples if needed.
Fields: appName, appType, oneSentencePitch, targetUsers, primaryUserJobs[], pages[{route,purpose}], routeMap[], componentMap[], dataModel[{name,columns[]}], authModel, permissionsModel, adminModel, integrations[], requiredEnvVars[{key,public,example}], designSystem, responsiveStrategy, emptyStates[], loadingStates[], errorStates[], monetizationAssumptions[], deploymentAssumptions[], estimatedComplexity (1-10), estimatedUserCredits, costSavingStrategy, qualityLevel, sourceMode:"llm_enriched", risks[], exclusions[], acceptanceCriteria[], buildStages[], buildConfidence (0-100).`;

export async function enrichBlueprintWithLlm(
  input: EnrichBlueprintInput,
): Promise<{ blueprint: AppBlueprint; providerCostUsd: number } | { error: string }> {
  const base = buildDeterministicBlueprint({
    prompt: input.prompt,
    templateId: input.templateId,
    modelId: input.modelId,
    qualityLevel: input.qualityLevel,
  });

  let contextBlock = "";
  if (input.existingFiles?.length) {
    const compressed = compressProjectContext(input.existingFiles, new Set());
    contextBlock = `\nProject context (compressed):\n${JSON.stringify(compressed.files.slice(0, 20))}`;
  }

  const userPrompt = `User prompt:\n${input.prompt}\n\nQuality: ${input.qualityLevel}\nEstimated credits budget: ${base.estimatedUserCredits}\n\nBaseline blueprint JSON:\n${JSON.stringify(base)}${contextBlock}\n\nImprove into a production-grade blueprint. Keep estimatedUserCredits >= ${base.estimatedUserCredits}.`;

  try {
    const result = await callProviderStructured({
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: input.operationId,
      operationType: "build_plan",
      system: BLUEPRINT_SYSTEM,
      prompt: userPrompt,
      complexity: base.estimatedComplexity,
      projectId: input.projectId,
    });

    const parsed = parseJsonFromModel<Record<string, unknown>>(result.text);
    if (!parsed) {
      return { blueprint: { ...base, sourceMode: "deterministic_quick" }, providerCostUsd: result.providerCostUsd };
    }

    const merged = {
      ...base,
      ...parsed,
      sourceMode: "llm_enriched" as const,
      qualityLevel: input.qualityLevel,
      estimatedUserCredits: Math.max(
        base.estimatedUserCredits,
        typeof parsed.estimatedUserCredits === "number" ? parsed.estimatedUserCredits : base.estimatedUserCredits,
      ),
    };

    const valid = parseAppBlueprint(merged);
    if (!valid.ok) {
      const err = validateBlueprintContent(base);
      if (err) return { error: err };
      return { blueprint: base, providerCostUsd: result.providerCostUsd };
    }

    return { blueprint: valid.blueprint, providerCostUsd: result.providerCostUsd };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "blueprint_enrich_failed";
    return { blueprint: base, providerCostUsd: 0 };
  }
}
