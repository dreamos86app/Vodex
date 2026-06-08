import { sanitizeUserFacingAiError } from "@/lib/ai/provider-errors";

const API_KEY_RE = /\b(sk-(?:proj-)?[a-zA-Z0-9_*-]{8,})\b/gi;

/** Redact API key material from diagnostic strings — never persist sk-* in owner UI. */
export function redactSecretsInDiagnosticText(text: string): string {
  return text.replace(API_KEY_RE, (match) => {
    const prefix = match.toLowerCase().startsWith("sk-proj") ? "sk-proj-" : "sk-";
    return `${prefix}***`;
  });
}

export function isAuthRelatedDiagnosticMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("incorrect api key") ||
    m.includes("invalid api key") ||
    m.includes("invalid_api_key") ||
    m.includes("authentication") ||
    m.includes("unauthorized") ||
    m.includes("platform ai key")
  );
}

/** User-safe + redacted diagnostic message for owner console / sessionStorage. */
export function sanitizeDiagnosticMessage(raw: string | null | undefined): string {
  if (!raw) return "";
  const redacted = redactSecretsInDiagnosticText(String(raw));
  return sanitizeUserFacingAiError(redacted);
}

export function sanitizeDiagnosticDetail(
  detail?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!detail) return undefined;
  const out: Record<string, unknown> = { ...detail };
  if (typeof out.message === "string") {
    out.message = sanitizeDiagnosticMessage(out.message);
  }
  if (typeof out.error === "string") {
    out.error = sanitizeDiagnosticMessage(out.error);
  }
  return out;
}
