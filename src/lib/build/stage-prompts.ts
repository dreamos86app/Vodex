/** Compact JSON-only prompts for staged build pipeline. */

import { appTypePromptBlock, resolveAppTypeFromPrompt } from "@/lib/generation/app-type-ui-requirements";
import { buildFullUiGenerationBlock } from "@/lib/generation/ui-quality-spec";

export const JSON_ONLY_RULE =
  "Return ONLY valid JSON. No markdown, no code fences, no prose outside JSON.";

export const FILE_PAYLOAD_RULE = [
  JSON_ONLY_RULE,
  `Return exactly:`,
  `{ "files": [{ "path": "app/page.tsx", "language": "tsx", "content": "..." }],`,
  `  "events": [{ "type": "wrote", "path": "", "summary": "" }],`,
  `  "metadata": { "app_name": "" } }`,
  "No markdown fences. No TODO, coming soon, or lorem ipsum placeholders.",
  "Each page must include loading, empty, and error UI states (skeleton/spinner + empty message + error retry).",
  "Use Tailwind className on all layout elements — mobile-first responsive (sm:/md: breakpoints).",
  "Generate app-specific sections (CRM: contacts/deals/tasks; dashboard: metrics/chart/filters; booking: calendar/summary).",
  "Include 3–8 route files under app/ matching the blueprint routeMap.",
].join("\n");

function uiQualityBlock(userPrompt: string): string {
  const req = resolveAppTypeFromPrompt(userPrompt);
  const appType = req?.id ?? null;
  return [
    appTypePromptBlock(appType),
    buildFullUiGenerationBlock({ appType, buildTier: "standard", stylePresetId: "minimal" }),
  ].join("\n");
}

export function buildPlanPrompt(userPrompt: string, scopeNote: string): string {
  return [
    JSON_ONLY_RULE,
    `User request: ${userPrompt.slice(0, 2000)}`,
    scopeNote,
    `Return: { "complexity": 1-10, "summary": "", "steps": ["..."], "pages": ["..."], "entities": ["..."], "core_v1_only": boolean, "queued_later": ["..."] }`,
  ].join("\n");
}

export function appIdentityPrompt(userPrompt: string, planJson: string): string {
  return [
    JSON_ONLY_RULE,
    `Plan: ${planJson.slice(0, 1500)}`,
    `User: ${userPrompt.slice(0, 800)}`,
    `Return: { "app": { "name": "", "slug": "", "description": "", "category": "", "theme": { "primary": "", "accent": "", "background": "", "style": "premium" } } }`,
    "App name must be specific (not New App). No markdown in name.",
  ].join("\n");
}

export function iconSvgPrompt(appName: string, category: string): string {
  return [
    JSON_ONLY_RULE,
    `App: ${appName}, category: ${category}`,
    `Return: { "icon_svg": "<svg xmlns=... viewBox=0 0 64 64>...</svg>" }`,
    "Simple flat icon, single color gradient, no external images.",
  ].join("\n");
}

export function schemaPrompt(planJson: string): string {
  return [
    JSON_ONLY_RULE,
    `Plan: ${planJson.slice(0, 2000)}`,
    `Return: { "entities": [{ "name": "", "fields": [{ "name": "", "type": "" }] }], "rls_notes": "" }`,
  ].join("\n");
}

export function uiPlanPrompt(planJson: string, schemaJson: string, userPrompt?: string): string {
  return [
    JSON_ONLY_RULE,
    `Plan: ${planJson.slice(0, 1200)}`,
    `Schema: ${schemaJson.slice(0, 1200)}`,
    userPrompt ? uiQualityBlock(userPrompt) : "",
    `Return: { "navigation": "", "screens": [{ "id": "", "title": "", "components": [] }], "design_tokens": {} }`,
  ].join("\n");
}

export function frontendPrompt(
  userPrompt: string,
  planJson: string,
  uiJson: string,
  maxFiles: number,
): string {
  return [
    FILE_PAYLOAD_RULE,
    uiQualityBlock(userPrompt),
    `Max ${maxFiles} files. REQUIRED: app/page.tsx and at least 2 feature routes under app/ matching the plan.`,
    "Do NOT return preview-only output — route files under app/ are mandatory.",
    `User: ${userPrompt.slice(0, 1000)}`,
    `Plan: ${planJson.slice(0, 1000)}`,
    `UI: ${uiJson.slice(0, 1000)}`,
  ].join("\n");
}

export function minimalFrontendPrompt(userPrompt: string, planJson: string): string {
  return [
    FILE_PAYLOAD_RULE,
    "Return EXACTLY 4 files with complete JSX (keep each file concise):",
    "1) package.json — next/react deps with dev/build/start scripts",
    "2) app/layout.tsx — root layout with Tailwind",
    "3) app/page.tsx — hero + primary CTA + app-specific sections",
    "4) app/dashboard/page.tsx OR app/features/page.tsx — secondary screen with list/cards",
    uiQualityBlock(userPrompt),
    `User: ${userPrompt.slice(0, 800)}`,
    `Plan: ${planJson.slice(0, 800)}`,
  ].join("\n");
}

export function backendPrompt(planJson: string, schemaJson: string): string {
  return [
    FILE_PAYLOAD_RULE,
    "Generate API routes, server actions, or lib modules only if needed.",
    `Plan: ${planJson.slice(0, 1000)}`,
    `Schema: ${schemaJson.slice(0, 1000)}`,
  ].join("\n");
}
