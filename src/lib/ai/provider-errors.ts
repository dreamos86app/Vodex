import { isProviderSelectable } from "@/lib/ai/provider-availability";

export type ProviderName = "anthropic" | "openai" | "google" | "xai" | "unknown";

export type ProviderErrorClass =
  | "available"
  | "degraded"
  | "quota_exhausted"
  | "auth_error"
  | "rate_limited"
  | "provider_down"
  | "network_error"
  | "invalid_request"
  | "disabled"
  | "coming_soon"
  | "unknown";

const QUOTA_RE =
  /insufficient.?credit|balance|quota|billing|payment.?required|exceeded.*limit|out of credits|credit balance/i;
const AUTH_RE = /invalid.?api.?key|unauthorized|authentication|401|403|invalid x-api-key/i;
const RATE_RE = /rate.?limit|too many requests|429|overloaded/i;
const DOWN_RE = /503|502|service unavailable|provider unavailable|overloaded/i;

export function providerFromModelId(modelId: string): ProviderName {
  const api = modelId.toLowerCase();
  if (api.includes("claude") || api.includes("anthropic")) return "anthropic";
  if (api.includes("gpt") || api.includes("openai")) return "openai";
  if (api.includes("gemini") || api.includes("google")) return "google";
  if (api.includes("grok") || api.includes("xai")) return "xai";
  return "unknown";
}

export function classifyProviderError(error: unknown): {
  provider: ProviderName;
  errorClass: ProviderErrorClass;
  retryable: boolean;
  failover: boolean;
  raw: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const m = raw.toLowerCase();
  let errorClass: ProviderErrorClass = "unknown";
  if (QUOTA_RE.test(m)) errorClass = "quota_exhausted";
  else if (AUTH_RE.test(m)) errorClass = "auth_error";
  else if (RATE_RE.test(m)) errorClass = "rate_limited";
  else if (DOWN_RE.test(m)) errorClass = "provider_down";
  else if (/network|fetch failed|econnreset|timeout/i.test(m)) errorClass = "network_error";
  else if (/invalid|400|bad request/i.test(m)) errorClass = "invalid_request";

  const provider =
    /anthropic|claude/i.test(raw)
      ? "anthropic"
      : /openai|gpt/i.test(raw)
        ? "openai"
        : /google|gemini/i.test(raw)
          ? "google"
          : "unknown";

  const failover =
    errorClass === "quota_exhausted" ||
    errorClass === "rate_limited" ||
    errorClass === "provider_down" ||
    errorClass === "auth_error";

  const retryable = errorClass === "network_error" || errorClass === "rate_limited" || errorClass === "provider_down";

  return { provider, errorClass, retryable, failover, raw: raw.slice(0, 500) };
}

/** Pick fallback catalog model when primary provider fails. */
export function pickFailoverCatalogModel(
  failedProvider: ProviderName,
  operationType: string,
): string | null {
  const preferOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const preferGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  const preferAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  const cheap = (): string | null => {
    if (preferOpenAi && isProviderSelectable("openai")) return "gpt-5.4-mini";
    if (preferGoogle && isProviderSelectable("google")) return "gemini-flash";
    if (preferAnthropic && isProviderSelectable("anthropic")) return "claude-haiku-4.5";
    return null;
  };

  const medium = (): string | null => {
    if (preferOpenAi && isProviderSelectable("openai")) return "gpt-5.4-mini";
    if (preferGoogle && isProviderSelectable("google")) return "gemini-flash";
    if (preferAnthropic && failedProvider !== "anthropic" && isProviderSelectable("anthropic")) {
      return "claude-sonnet-4.5";
    }
    return cheap();
  };

  if (failedProvider === "anthropic") {
    return operationType.includes("implementation") || operationType.includes("repair_hard")
      ? medium()
      : cheap();
  }
  if (failedProvider === "openai") {
    if (preferGoogle) return "gemini-flash";
    if (preferAnthropic) return "claude-haiku-4.5";
    return null;
  }
  if (failedProvider === "google") {
    if (preferOpenAi) return "gpt-5.4-mini";
    if (preferAnthropic) return "claude-haiku-4.5";
    return null;
  }
  return cheap();
}

export function userFacingProviderMessage(
  errorClass: ProviderErrorClass,
  didFailover: boolean,
): string {
  if (didFailover) {
    return "That model is temporarily unavailable. I switched to another available model and continued.";
  }
  if (errorClass === "quota_exhausted" || errorClass === "provider_down" || errorClass === "rate_limited") {
    return "The AI system is temporarily busy. Please try again shortly.";
  }
  if (errorClass === "auth_error") {
    return "The AI system is temporarily busy. Please try again shortly.";
  }
  return "Something went wrong while generating a response. Please try again.";
}

export function sanitizeUserFacingAiError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("unable to verify") ||
    m.includes("certificate") ||
    m.includes("fetch failed") ||
    m.includes("unable_to_verify")
  ) {
    return "Connection setup is temporarily unavailable. Please try again shortly.";
  }
  if (m.includes("charge_tokens") || m.includes("schema cache") || m.includes("could not find the function")) {
    return "AI requests are temporarily paused while billing sync finishes. Please try again shortly.";
  }
  if (AUTH_RE.test(m) || m.includes("incorrect api key")) {
    return "Platform AI key is invalid or outdated. Update OPENAI_API_KEY on the server, redeploy or restart, then retry.";
  }
  if (QUOTA_RE.test(m) && /anthropic|claude/i.test(m)) {
    return "That model is temporarily unavailable. I switched to another available model and continued.";
  }
  if (QUOTA_RE.test(m) || m.includes("insufficient_tokens") || m.includes("not enough credits")) {
    return "You do not have enough credits for this request. Please upgrade or buy more credits.";
  }
  if (/anthropic|claude/i.test(m) && (QUOTA_RE.test(m) || AUTH_RE.test(m))) {
    return "The AI system is temporarily busy. Please try again shortly.";
  }
  return userFacingProviderMessage(classifyProviderError(raw).errorClass, false);
}
