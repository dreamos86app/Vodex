import { DISCUSS_MAX_OUTPUT_TOKENS, resolveDiscussModeModel } from "@/lib/ai/discuss-mode-policy";
import { routeOperation } from "@/lib/ai/model-router";

/** Ultra-fast discuss — no build worker, no preview, cheapest safe model only. */
export function resolveFastDiscussStreamSpec(input: {
  ownerEmail?: string | null;
  manualModelSelection?: boolean;
  requestedModelId?: string | null;
  planId?: string | null;
}) {
  const { modelId: cheapId } = resolveDiscussModeModel({
    planId: input.planId,
    requestedModelId: null,
  });
  const spec = routeOperation({
    operationType: "discuss_stream",
    ownerEmail: input.ownerEmail,
    requestedModelId: cheapId,
    complexity: 1,
  });
  return {
    ...spec,
    modelId: cheapId,
    maxOutputTokens: Math.min(spec.maxOutputTokens, DISCUSS_MAX_OUTPUT_TOKENS),
  };
}

export function isFastDiscussMode(modeAtSubmit: string | undefined): boolean {
  return modeAtSubmit === "discuss";
}
