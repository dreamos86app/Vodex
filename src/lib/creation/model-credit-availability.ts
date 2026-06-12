import { CREATION_MODELS, type CreationModel } from "@/lib/creation/models";
import { BUILD_UI_EXCLUDED_MODEL_IDS } from "@/lib/creation/model-ratings";

/** Minimum build credits needed to start a turn with this model (relative to catalog weight). */
export function minBuildCreditsForModel(model: Pick<CreationModel, "credits" | "id">): number {
  if (model.id === "automatic") return 1;
  return Math.max(1, Math.ceil(model.credits * 0.75));
}

export function isModelAffordableForBuild(
  model: Pick<CreationModel, "credits" | "id">,
  buildCreditsAvailable: number,
): boolean {
  if (buildCreditsAvailable <= 0) return model.id === "automatic" ? false : false;
  return buildCreditsAvailable >= minBuildCreditsForModel(model);
}

export function pickAffordableModelId(
  preferredId: string,
  buildCreditsAvailable: number,
): { modelId: string; switched: boolean; reason: string } {
  if (preferredId === "automatic") {
    return { modelId: "automatic", switched: false, reason: "automatic" };
  }

  const preferred = CREATION_MODELS.find((m) => m.id === preferredId);
  if (preferred && isModelAffordableForBuild(preferred, buildCreditsAvailable)) {
    return { modelId: preferredId, switched: false, reason: "preferred_affordable" };
  }

  const affordable = [...CREATION_MODELS]
    .filter(
      (m) =>
        !BUILD_UI_EXCLUDED_MODEL_IDS.has(m.id) &&
        m.ratings.frontend >= 4 &&
        isModelAffordableForBuild(m, buildCreditsAvailable),
    )
    .sort((a, b) => a.credits - b.credits);

  if (affordable[0]) {
    return {
      modelId: affordable[0]!.id,
      switched: preferredId !== affordable[0]!.id,
      reason: "insufficient_credits_cheap_fallback",
    };
  }

  return { modelId: "automatic", switched: preferredId !== "automatic", reason: "insufficient_credits_automatic" };
}

export function modelUnaffordableReason(buildCreditsAvailable: number): string {
  if (buildCreditsAvailable <= 0) {
    return "Out of build credits — add credits or use Automatic routing.";
  }
  return "Not enough build credits for this model — try a cheaper model or Automatic.";
}
