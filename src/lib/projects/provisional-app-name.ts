/**
 * Placeholder app names/icons until the build identity step assigns real branding.
 */

export const UNTITLED_APP_NAME = "Untitled App";

const PROVISIONAL_EXACT = new Set(
  [
    "untitled app",
    "untitled",
    "new app",
    "new build",
    "dream app",
    "your app",
    "app",
  ].map((s) => s.toLowerCase()),
);

const CONVERSATIONAL_LEAD =
  /\b(i want you to|i need you to|i'd like you to|i would like you to|can you|could you|please|help me|i want to|i need to|i'd like to)\b/i;

const IMPERATIVE_FRAGMENT =
  /\b(want|you|to|create|make|build|generate|design|please|help|full|need|me|my|a|an|the)\b/i;

/** True when the string looks like raw prompt text, not a brand name. */
export function looksLikePromptFragment(name: string): boolean {
  const raw = name.trim();
  if (!raw || raw.length < 3) return true;
  if (CONVERSATIONAL_LEAD.test(raw)) return true;

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  const imperativeHits = words.filter((w) => IMPERATIVE_FRAGMENT.test(w)).length;
  if (words.length >= 3 && imperativeHits >= 2) return true;

  const lower = raw.toLowerCase();
  if (/^(i|we)\s/.test(lower)) return true;
  if (/\b(app|application|website|site|platform)\s*!*$/i.test(raw) && imperativeHits >= 1) return true;

  return false;
}

export function isProvisionalAppName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return true;
  if (PROVISIONAL_EXACT.has(trimmed.toLowerCase())) return true;
  return looksLikePromptFragment(trimmed);
}

export function resolveProjectDisplayName(input: {
  name?: string | null;
  app_name?: string | null;
}): string {
  const appName = input.app_name?.trim();
  if (appName && !isProvisionalAppName(appName)) return appName;

  const name = input.name?.trim();
  if (name && !isProvisionalAppName(name)) return name;

  return UNTITLED_APP_NAME;
}
