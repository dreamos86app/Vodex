import { pickFreeDiscussModelId } from "@/lib/ai/discuss-model";
import { routeOperation } from "@/lib/ai/model-router";

/** Ultra-fast discuss — no build worker, no preview, cheapest model. */
export function resolveFastDiscussStreamSpec(input: {
  ownerEmail?: string | null;
  manualModelSelection: boolean;
  requestedModelId?: string | null;
}) {
  const cheapId = pickFreeDiscussModelId();
  const modelId =
    input.manualModelSelection && input.requestedModelId
      ? input.requestedModelId
      : cheapId;
  const spec = routeOperation({
    operationType: "discuss_stream",
    ownerEmail: input.ownerEmail,
    requestedModelId: modelId,
    complexity: 1,
  });
  return {
    ...spec,
    modelId: input.manualModelSelection ? spec.modelId : cheapId,
    maxOutputTokens: Math.min(spec.maxOutputTokens, 1200),
  };
}

export function isFastDiscussMode(modeAtSubmit: string | undefined): boolean {
  return modeAtSubmit === "discuss";
}
