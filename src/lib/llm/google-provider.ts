import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { googleGenerativeApiKey } from "@/lib/llm/env-keys";

let cached: GoogleGenerativeAIProvider | null = null;
let cachedKey: string | null = null;

/** Google provider that accepts GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. */
export function getGoogleProvider(): GoogleGenerativeAIProvider {
  const apiKey = googleGenerativeApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Generative AI API key is missing. Set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY in the server environment.",
    );
  }
  if (!cached || cachedKey !== apiKey) {
    cached = createGoogleGenerativeAI({ apiKey });
    cachedKey = apiKey;
  }
  return cached;
}

export function resolveGoogleLanguageModel(apiModelId: string) {
  return getGoogleProvider()(apiModelId);
}
