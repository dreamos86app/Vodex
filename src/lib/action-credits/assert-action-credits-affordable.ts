import { quoteActionCredits } from "@/lib/action-credits/action-credit-pricing";
import { isFreeRuntimeAction } from "@/lib/action-credits/action-catalog";
import { getActionCreditAvailability } from "@/lib/action-credits/get-action-credit-availability";
import { shouldSkipActionCreditsForOwnProvider } from "@/lib/action-credits/own-provider-skip";

export const RUNTIME_ACTION_UNAVAILABLE_MESSAGE =
  "This AI feature is temporarily unavailable. Please try again later.";

export type AssertActionCreditsInput = {
  ownerUserId: string;
  projectId?: string | null;
  actionType: string;
  providerCostUsd?: number | null;
  dynamicFloor?: number | null;
};

export type AssertActionCreditsResult =
  | { ok: true; required: number; balance: number; quote: ReturnType<typeof quoteActionCredits> }
  | {
      ok: false;
      required: number;
      balance: number;
      code: "insufficient";
      quote: ReturnType<typeof quoteActionCredits>;
    };

/** Atomic pre-check — must pass before any paid provider call. */
export async function assertActionCreditsAffordable(
  input: AssertActionCreditsInput,
): Promise<AssertActionCreditsResult> {
  const quote = quoteActionCredits({
    actionType: input.actionType,
    providerCostUsd: input.providerCostUsd,
    dynamicFloor: input.dynamicFloor,
  });

  const availability = await getActionCreditAvailability(input.ownerUserId, {
    projectId: input.projectId,
    actionType: input.actionType,
    providerCostUsd: input.providerCostUsd,
  });

  if (quote.isFree || isFreeRuntimeAction(quote.canonicalType)) {
    return { ok: true, required: 0, balance: availability.totalAvailable, quote };
  }

  if (
    input.projectId &&
    (await shouldSkipActionCreditsForOwnProvider({
      projectId: input.projectId,
      actionType: quote.canonicalType,
    }))
  ) {
    return { ok: true, required: 0, balance: availability.totalAvailable, quote };
  }

  const required = quote.finalActionCredits;
  const balance = availability.totalAvailable;

  if (!availability.available || balance < required) {
    return { ok: false, required, balance, code: "insufficient", quote };
  }

  return { ok: true, required, balance, quote };
}
