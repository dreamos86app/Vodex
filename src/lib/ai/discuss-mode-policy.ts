import "server-only";

import { pickFreeDiscussModelId } from "@/lib/ai/discuss-model";
import { pickCheapestSafeDiscussModel } from "@/lib/ai/model-routing-cost-policy";

import {
  DISCUSS_MAX_INPUT_TOKENS,
  DISCUSS_MAX_OUTPUT_TOKENS,
} from "@/lib/billing/discuss-credit-pricing";

export { DISCUSS_MAX_INPUT_TOKENS, DISCUSS_MAX_OUTPUT_TOKENS };

/** Discuss answers: helpful medium length — not one-liners, not essays. */
export const DISCUSS_TEMPERATURE = 0.55;

/** Users never pick a discuss model — routing is internal only. */
export function discussModelSelectorVisible(): false {
  return false;
}

export function resolveDiscussModeModel(_input?: {
  planId?: string | null;
  requestedModelId?: string | null;
}): { modelId: string; userVisibleLabel: "Vodex Discuss" } {
  const modelId = pickCheapestSafeDiscussModel() || pickFreeDiscussModelId();
  return { modelId, userVisibleLabel: "Vodex Discuss" };
}

export function discussRedirectForBuildIntent(intent: "build" | "edit" | "code"): string {
  if (intent === "build") {
    return "Discuss mode is for guidance only. Switch to **Build** on Create (/create) to generate an app.";
  }
  if (intent === "edit" || intent === "code") {
    return "Discuss mode cannot edit files. Open your app in **Builder** and use Edit mode there.";
  }
  return "Use Build or Edit mode for code changes.";
}
