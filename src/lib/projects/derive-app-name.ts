/**
 * Legacy helper — never surface raw prompt text as an app name.
 * Real names are assigned during the build identity step.
 */

import { UNTITLED_APP_NAME } from "@/lib/projects/provisional-app-name";

const CONCEPT_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /\b(recipe|recipes|cookbook|meal plan)\b/i, name: "Recipe Studio" },
  { re: /\b(crm|customer relationship)\b/i, name: "CRM Workspace" },
  { re: /\b(e-?commerce|online store|shop)\b/i, name: "Online Store" },
  { re: /\b(booking|appointment|salon|clinic)\b/i, name: "Booking App" },
  { re: /\b(finance|budget|expense|money tracker)\b/i, name: "Finance Tracker" },
  { re: /\b(chatbot|ai assistant|ai chat)\b/i, name: "AI Assistant" },
  { re: /\b(social|community|feed)\b/i, name: "Social App" },
  { re: /\b(portfolio|resume|cv)\b/i, name: "Portfolio" },
  { re: /\b(dashboard|analytics|saas)\b/i, name: "SaaS Dashboard" },
  { re: /\b(habit|fitness|workout|gym)\b/i, name: "Fitness App" },
  { re: /\b(marketplace|listing)\b/i, name: "Marketplace" },
  { re: /\b(landing page|marketing site)\b/i, name: "Landing Page" },
  { re: /\b(helpdesk|support ticket)\b/i, name: "Support Desk" },
  { re: /\b(course|learning|lesson)\b/i, name: "Learning App" },
];

/** Deterministic concept label — always falls back to Untitled App (never prompt fragments). */
export function deriveAppNameFromPrompt(prompt: string): string {
  const raw = prompt.trim();
  if (!raw) return UNTITLED_APP_NAME;

  for (const { re, name } of CONCEPT_PATTERNS) {
    if (re.test(raw)) return name;
  }

  return UNTITLED_APP_NAME;
}
