/**
 * P1.3.9 — Never expose compressed build plans as user-facing descriptions.
 */
import { isInternalBuildPlanText } from "@/lib/build/build-state-truth";

export type UserDescriptionInput = {
  originalPrompt?: string | null;
  appName?: string | null;
  archetype?: string | null;
  generatedRoutes?: string[];
};

const BUILD_VERB_RE = /^(build|create|make|design)\s+(me\s+)?(a|an|the)\s+/i;

function cleanPrompt(prompt: string): string {
  return prompt
    .replace(BUILD_VERB_RE, "")
    .replace(/\?+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function archetypeBlurb(archetype: string, name: string): string {
  const a = archetype.toLowerCase();
  if (/finance|budget|ledger/.test(a)) {
    return `${name} helps users track budgets, goals, spending trends, and alerts in one clean finance dashboard.`;
  }
  if (/crm|sales|client/.test(a)) {
    return `${name} helps teams manage contacts, pipelines, and customer relationships in one place.`;
  }
  if (/restaurant|food|recipe/.test(a)) {
    return `${name} helps restaurants manage menus, inventory, and daily operations.`;
  }
  return `${name} is a polished web app built for your workflow.`;
}

/** Derive a short, user-safe app description (max 240 chars). */
export function deriveUserFacingAppDescription(input: UserDescriptionInput): string {
  const name = (input.appName ?? "Your app").trim() || "Your app";
  const prompt = input.originalPrompt?.trim() ?? "";

  if (prompt && !isInternalBuildPlanText(prompt)) {
    const cleaned = cleanPrompt(prompt);
    if (cleaned.length >= 12 && cleaned.length <= 220) {
      const capped = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!capped.endsWith(".")) return `${capped}.`;
      return capped;
    }
    if (cleaned.length > 220) {
      const sentence = cleaned.split(/[.!?]/)[0]?.trim();
      if (sentence && sentence.length >= 12) {
        return sentence.endsWith(".") ? sentence : `${sentence}.`;
      }
    }
  }

  if (input.archetype) {
    return archetypeBlurb(input.archetype, name).slice(0, 240);
  }

  if (input.generatedRoutes?.length) {
    const routes = input.generatedRoutes.slice(0, 4).join(", ");
    return `${name} includes ${routes} and other core screens for your workflow.`.slice(0, 240);
  }

  return `${name} is a custom app built with Vodex.`.slice(0, 240);
}

export function sanitizeStoredDescription(
  raw: string | null | undefined,
  fallbackInput: UserDescriptionInput,
): string {
  if (!raw?.trim() || isInternalBuildPlanText(raw)) {
    return deriveUserFacingAppDescription(fallbackInput);
  }
  return raw.trim().slice(0, 240);
}
