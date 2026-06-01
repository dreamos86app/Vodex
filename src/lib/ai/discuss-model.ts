import { resolveDiscussModel } from "@/lib/ai/provider-fallback";

/** Cheapest available discuss model — OpenAI mini / flash first. */
export function pickFreeDiscussModelId(): string {
  return resolveDiscussModel(null).modelId;
}
