import type { ProviderErrorClass, ProviderName } from "@/lib/ai/provider-errors";
import { googleGenerativeApiKey } from "@/lib/llm/env-keys";

type ProviderState = {
  status: ProviderErrorClass;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  lastErrorClass: ProviderErrorClass | null;
};

const state: Record<ProviderName, ProviderState> = {
  anthropic: { status: "available", lastErrorAt: null, lastSuccessAt: null, lastErrorClass: null },
  openai: { status: "available", lastErrorAt: null, lastSuccessAt: null, lastErrorClass: null },
  google: { status: "available", lastErrorAt: null, lastSuccessAt: null, lastErrorClass: null },
  xai: { status: "coming_soon", lastErrorAt: null, lastSuccessAt: null, lastErrorClass: null },
  unknown: { status: "unknown", lastErrorAt: null, lastSuccessAt: null, lastErrorClass: null },
};

function envDisabled(p: ProviderName): boolean {
  if (p === "anthropic") return process.env.AI_PROVIDER_DISABLE_ANTHROPIC === "1";
  if (p === "openai") return process.env.AI_PROVIDER_DISABLE_OPENAI === "1";
  if (p === "google") return process.env.AI_PROVIDER_DISABLE_GOOGLE === "1";
  return false;
}

export function isProviderConfigured(p: ProviderName): boolean {
  if (p === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (p === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (p === "google") return Boolean(googleGenerativeApiKey());
  if (p === "xai") return Boolean(process.env.XAI_API_KEY?.trim());
  return false;
}

export function recordProviderSuccess(provider: ProviderName): void {
  if (provider === "unknown" || provider === "xai") return;
  state[provider].lastSuccessAt = new Date().toISOString();
  if (state[provider].status !== "disabled") {
    state[provider].status = "available";
  }
}

export function recordProviderFailure(provider: ProviderName, errorClass: ProviderErrorClass): void {
  if (provider === "unknown" || provider === "xai") return;
  state[provider].lastErrorAt = new Date().toISOString();
  state[provider].lastErrorClass = errorClass;
  if (errorClass === "quota_exhausted" || errorClass === "auth_error") {
    state[provider].status = errorClass;
  } else if (errorClass === "rate_limited" || errorClass === "provider_down") {
    state[provider].status = "degraded";
  }
}

export function getProviderStatus(provider: ProviderName): ProviderState & { configured: boolean; disabled: boolean } {
  const disabled = envDisabled(provider);
  const configured = isProviderConfigured(provider);
  let status = state[provider].status;
  if (disabled) status = "disabled";
  else if (!configured) status = "disabled";
  else if (provider === "xai") status = "coming_soon";
  return { ...state[provider], status, configured, disabled };
}

export function isProviderSelectable(provider: ProviderName): boolean {
  const s = getProviderStatus(provider);
  return s.configured && !s.disabled && s.status !== "quota_exhausted" && s.status !== "auth_error";
}

export function listProviderHealthSummary(): Array<{
  provider: ProviderName;
  configured: boolean;
  status: ProviderErrorClass | "coming_soon" | "disabled";
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorClass: ProviderErrorClass | null;
}> {
  return (["anthropic", "openai", "google", "xai"] as ProviderName[]).map((provider) => {
    const s = getProviderStatus(provider);
    return {
      provider,
      configured: s.configured,
      status: s.status,
      lastSuccessAt: s.lastSuccessAt,
      lastErrorAt: s.lastErrorAt,
      lastErrorClass: s.lastErrorClass,
    };
  });
}
