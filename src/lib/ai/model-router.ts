import { googleGenerativeApiKey, hasAnyLlmProviderKey } from "@/lib/llm/env-keys";

export type AiTaskMode =
  | "discuss"
  | "edit"
  | "build"
  | "design"
  | "code"
  | "polish"
  | "image"
  | "planning";

const AUTOMATIC_ALIASES = new Set(["automatic", "auto", "default"]);

export type ModelRouteResult = {
  mode: AiTaskMode;
  provider: "anthropic" | "openai" | "google" | "unknown";
  modelId: string;
  estimatedTier: "fast" | "standard" | "premium";
  isFallback: boolean;
  missingEnv: string[];
  routeReason: string;
};

function envModel(key: string, fallback: string): string {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : fallback;
}

function providerForModel(modelId: string): ModelRouteResult["provider"] {
  if (modelId.startsWith("claude")) return "anthropic";
  if (modelId.startsWith("gpt")) return "openai";
  if (modelId.startsWith("gemini")) return "google";
  return "unknown";
}

function strongestBuildModel(): { modelId: string; missing: string[] } {
  const missing: string[] = [];
  const configured = envModel("DREAMOS_BUILD_MODEL", "");
  if (configured) return { modelId: configured, missing };

  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return { modelId: "claude-sonnet-4-6", missing };
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { modelId: "gpt-4o", missing };
  }
  if (googleGenerativeApiKey()) {
    return { modelId: "gemini-2.0-flash", missing };
  }
  missing.push("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  return { modelId: "claude-sonnet-4-6", missing };
}

function discussModel(): { modelId: string; missing: string[] } {
  const configured = process.env.DREAMOS_DISCUSS_MODEL?.trim();
  if (configured) return { modelId: configured, missing: [] };

  if (process.env.OPENAI_API_KEY?.trim()) return { modelId: "gpt-4o-mini", missing: [] };
  if (googleGenerativeApiKey()) return { modelId: "gemini-2.0-flash", missing: [] };
  if (process.env.ANTHROPIC_API_KEY?.trim()) return { modelId: "claude-haiku-4-5", missing: [] };
  return { modelId: "gpt-4o-mini", missing: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"] };
}

export function isAutomaticModelId(modelId: string | undefined | null): boolean {
  if (!modelId) return true;
  return AUTOMATIC_ALIASES.has(modelId.trim().toLowerCase());
}

export function routeModel(
  mode: AiTaskMode,
  requestedModelId?: string | null,
): ModelRouteResult {
  const missingEnv: string[] = [];

  if (!hasAnyLlmProviderKey()) {
    return {
      mode,
      provider: "unknown",
      modelId: "unconfigured",
      estimatedTier: "fast",
      isFallback: true,
      missingEnv: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
      routeReason: "No LLM provider API keys configured",
    };
  }

  if (requestedModelId && !isAutomaticModelId(requestedModelId)) {
    return {
      mode,
      provider: providerForModel(requestedModelId),
      modelId: requestedModelId,
      estimatedTier: mode === "discuss" ? "fast" : "premium",
      isFallback: false,
      missingEnv: [],
      routeReason: "User-selected model",
    };
  }

  if (mode === "build" || mode === "code") {
    const { modelId, missing } = strongestBuildModel();
    const configured = process.env.DREAMOS_BUILD_MODEL?.trim();
    return {
      mode,
      provider: providerForModel(modelId),
      modelId,
      estimatedTier: "premium",
      isFallback: !configured && missing.length > 0,
      missingEnv: configured ? [] : missing,
      routeReason: configured
        ? `DREAMOS_BUILD_MODEL=${configured}`
        : missing.length > 0
          ? "DREAMOS_BUILD_MODEL not set — using strongest available provider default"
          : "Build task — premium model",
    };
  }

  if (mode === "edit" || mode === "design" || mode === "polish" || mode === "planning") {
    const editEnv = process.env.DREAMOS_EDIT_MODEL?.trim();
    const designEnv = process.env.DREAMOS_DESIGN_MODEL?.trim();
    const modelId = editEnv || designEnv || strongestBuildModel().modelId;
    return {
      mode,
      provider: providerForModel(modelId),
      modelId,
      estimatedTier: "standard",
      isFallback: false,
      missingEnv: [],
      routeReason: editEnv
        ? `DREAMOS_EDIT_MODEL=${editEnv}`
        : designEnv
          ? `DREAMOS_DESIGN_MODEL=${designEnv}`
          : "Edit/design — build-class model",
    };
  }

  if (mode === "image") {
    const imageModel = process.env.DREAMOS_IMAGE_MODEL?.trim();
    if (imageModel) {
      return {
        mode,
        provider: providerForModel(imageModel),
        modelId: imageModel,
        estimatedTier: "standard",
        isFallback: false,
        missingEnv: [],
        routeReason: `DREAMOS_IMAGE_MODEL=${imageModel}`,
      };
    }
    return {
      mode,
      provider: "unknown",
      modelId: "svg-fallback",
      estimatedTier: "fast",
      isFallback: true,
      missingEnv: [],
      routeReason: "SVG icon fallback",
    };
  }

  const { modelId, missing } = discussModel();
  const discussEnv = process.env.DREAMOS_DISCUSS_MODEL?.trim();
  return {
    mode: "discuss",
    provider: providerForModel(modelId),
    modelId,
    estimatedTier: "fast",
    isFallback: missing.length > 0,
    missingEnv: missing,
    routeReason: discussEnv
      ? `DREAMOS_DISCUSS_MODEL=${discussEnv}`
      : "Discuss — fast/cheap model",
  };
}

export function mapChatModeToTask(mode: "discuss" | "edit" | "build"): AiTaskMode {
  if (mode === "build") return "build";
  if (mode === "edit") return "edit";
  return "discuss";
}
