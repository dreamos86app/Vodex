/**
 * Strict Paddle environment / credential consistency (production vs sandbox).
 */
import { paddleEnvironment } from "@/lib/billing/paddle-billing";

export type PaddleEnvConsistencyResult = {
  ok: boolean;
  environment: "sandbox" | "production";
  errors: string[];
  warnings: string[];
  apiKeyConfigured: boolean;
  apiKeyMatchesEnvironment: boolean;
  clientTokenConfigured: boolean;
  clientTokenMatchesEnvironment: boolean;
  webhookSecretConfigured: boolean;
};

function isLiveApiKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("live") || k.startsWith("pdl_live");
}

function isSandboxApiKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("sdbx") || k.startsWith("pdl_sdbx") || k.includes("sandbox");
}

function isLiveClientToken(token: string): boolean {
  return token.startsWith("live_");
}

function isTestClientToken(token: string): boolean {
  return token.startsWith("test_");
}

export function validatePaddleEnvironmentConsistency(): PaddleEnvConsistencyResult {
  const environment = paddleEnvironment();
  const errors: string[] = [];
  const warnings: string[] = [];

  const apiKey = process.env.PADDLE_API_KEY?.trim() ?? "";
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim() ?? "";

  const apiKeyConfigured = Boolean(apiKey);
  const clientTokenConfigured = Boolean(clientToken);
  const webhookSecretConfigured = Boolean(webhookSecret);

  let apiKeyMatchesEnvironment = true;
  let clientTokenMatchesEnvironment = true;

  if (apiKeyConfigured) {
    if (environment === "production") {
      if (!isLiveApiKey(apiKey)) {
        apiKeyMatchesEnvironment = false;
        errors.push(
          "PADDLE_ENVIRONMENT=production but PADDLE_API_KEY does not look like a live key (expected pdl_live...).",
        );
      }
      if (isSandboxApiKey(apiKey) && !isLiveApiKey(apiKey)) {
        apiKeyMatchesEnvironment = false;
        errors.push("Sandbox API key cannot be used when PADDLE_ENVIRONMENT=production.");
      }
    } else {
      if (isLiveApiKey(apiKey) && !isSandboxApiKey(apiKey)) {
        apiKeyMatchesEnvironment = false;
        errors.push(
          "PADDLE_ENVIRONMENT=sandbox but PADDLE_API_KEY looks like a live key (pdl_live...).",
        );
      }
    }
  }

  if (clientTokenConfigured) {
    if (environment === "production") {
      if (isTestClientToken(clientToken)) {
        clientTokenMatchesEnvironment = false;
        errors.push(
          "PADDLE_ENVIRONMENT=production but NEXT_PUBLIC_PADDLE_CLIENT_TOKEN starts with test_. Use live_...",
        );
      }
      if (!isLiveClientToken(clientToken)) {
        warnings.push("Production client token does not start with live_ — confirm it is a live Paddle token.");
      }
    } else {
      if (isLiveClientToken(clientToken)) {
        clientTokenMatchesEnvironment = false;
        errors.push(
          "PADDLE_ENVIRONMENT=sandbox but NEXT_PUBLIC_PADDLE_CLIENT_TOKEN starts with live_. Use test_...",
        );
      }
    }
  }

  if (!apiKeyConfigured) errors.push("PADDLE_API_KEY is not configured.");
  if (!clientTokenConfigured) errors.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not configured.");
  if (!webhookSecretConfigured) errors.push("PADDLE_WEBHOOK_SECRET is not configured.");

  const ok =
    errors.length === 0 && apiKeyMatchesEnvironment && clientTokenMatchesEnvironment;

  return {
    ok,
    environment,
    errors,
    warnings,
    apiKeyConfigured,
    apiKeyMatchesEnvironment,
    clientTokenConfigured,
    clientTokenMatchesEnvironment,
    webhookSecretConfigured,
  };
}

/** Block checkout when env credentials are mixed or missing. */
export function assertPaddleCheckoutEnvironment(): { ok: true } | { ok: false; error: string; errors: string[] } {
  const result = validatePaddleEnvironmentConsistency();
  if (!result.ok) {
    return {
      ok: false,
      error: result.errors[0] ?? "Paddle environment configuration is invalid.",
      errors: result.errors,
    };
  }
  return { ok: true };
}
