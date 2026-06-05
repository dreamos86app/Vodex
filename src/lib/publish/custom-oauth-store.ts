import "server-only";

import { encryptSecretValue, redactSecretValue } from "@/lib/secrets/payment-secrets";

export type CustomOAuthProviderConfig = {
  client_id?: string;
  client_secret_sealed?: string;
};

export type CustomOAuthVault = {
  google?: CustomOAuthProviderConfig;
  github?: CustomOAuthProviderConfig;
  apple?: CustomOAuthProviderConfig;
};

export type CustomOAuthPublicStatus = {
  google: { configured: boolean; clientIdPreview: string | null };
  github: { configured: boolean; clientIdPreview: string | null };
  apple: { configured: boolean; gated: boolean; message: string };
};

const APPLE_GATED_MESSAGE =
  "Apple Sign In with custom credentials requires additional setup — use Vodex-managed OAuth for Apple for now.";

export function sealCustomOAuthInput(input: {
  existing?: CustomOAuthVault;
  google?: { client_id?: string; client_secret?: string };
  github?: { client_id?: string; client_secret?: string };
}): CustomOAuthVault {
  const out: CustomOAuthVault = { ...(input.existing ?? {}) };

  if (input.google) {
    out.google = {
      client_id: input.google.client_id?.trim() || out.google?.client_id,
      client_secret_sealed:
        input.google.client_secret?.trim()
          ? encryptSecretValue(input.google.client_secret.trim())
          : out.google?.client_secret_sealed,
    };
  }

  if (input.github) {
    out.github = {
      client_id: input.github.client_id?.trim() || out.github?.client_id,
      client_secret_sealed:
        input.github.client_secret?.trim()
          ? encryptSecretValue(input.github.client_secret.trim())
          : out.github?.client_secret_sealed,
    };
  }

  return out;
}

export function customOAuthProviderReady(vault: CustomOAuthVault, provider: "google" | "github"): boolean {
  const row = vault[provider];
  return Boolean(row?.client_id?.trim() && row?.client_secret_sealed?.trim());
}

export function validateCustomOAuthEnable(input: {
  vault: CustomOAuthVault;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (input.apple_enabled) {
    errors.push(APPLE_GATED_MESSAGE);
  }

  if (input.google_enabled && !customOAuthProviderReady(input.vault, "google")) {
    errors.push("Google custom OAuth requires Client ID and Client Secret.");
  }

  if (input.github_enabled && !customOAuthProviderReady(input.vault, "github")) {
    errors.push("GitHub custom OAuth requires Client ID and Client Secret.");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export function publicCustomOAuthStatus(vault: CustomOAuthVault): CustomOAuthPublicStatus {
  return {
    google: {
      configured: customOAuthProviderReady(vault, "google"),
      clientIdPreview: vault.google?.client_id ? redactSecretValue(vault.google.client_id) : null,
    },
    github: {
      configured: customOAuthProviderReady(vault, "github"),
      clientIdPreview: vault.github?.client_id ? redactSecretValue(vault.github.client_id) : null,
    },
    apple: {
      configured: false,
      gated: true,
      message: APPLE_GATED_MESSAGE,
    },
  };
}

export function parseCustomOAuthVault(raw: unknown): CustomOAuthVault {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CustomOAuthVault;
}
