/** Compact JSON-only prompts for staged build pipeline. */

import { appTypePromptBlock, resolveAppTypeFromPrompt } from "@/lib/generation/app-type-ui-requirements";
import { buildFullUiGenerationBlock } from "@/lib/generation/ui-quality-spec";
import { sliceToTokenBudget } from "@/lib/ai/prompt-compression-policy";
import type { BuildContextSlices } from "@/lib/build/heavy-input-budget";
import { buildStageObjective, sliceBriefForStage } from "@/lib/build/heavy-input-budget";

import type { DesignBrief } from "@/lib/build/design-brief-generator";
import { formatQualityContractForPrompt } from "@/lib/build/ui-quality-contract";

export const JSON_ONLY_RULE =
  "Return ONLY valid JSON. No markdown, no code fences, no prose outside JSON.";

export const FILE_PAYLOAD_RULE = [
  JSON_ONLY_RULE,
  `Return exactly:`,
  `{ "files": [{ "path": "app/page.tsx", "language": "tsx", "content": "..." }],`,
  `  "events": [{ "type": "wrote", "path": "", "summary": "" }],`,
  `  "metadata": { "app_name": "" } }`,
  "No markdown fences. No TODO, coming soon, or lorem ipsum placeholders.",
  "No framework names (Next.js, Vite, React, Tailwind) in user-visible UI text.",
  "Each page must include loading, empty, and error UI states (skeleton/spinner + empty message + error retry).",
  "Use Tailwind className on all layout elements — mobile-first responsive (sm:/md: breakpoints).",
  "You are generating the first production-quality version — premium SaaS UI, not a demo.",
  "Never ship Welcome + 3 plain cards only. Include app shell, nav, rich sections, realistic data.",
  "Include 3–8 route files under app/ matching the design brief routes.",
].join("\n");

function productionUiBlock(designBrief?: DesignBrief | null, executionBrief?: string): string {
  const parts = [formatQualityContractForPrompt()];
  if (designBrief?.promptBlock) parts.push(designBrief.promptBlock);
  else if (executionBrief) parts.push(uiQualityBlock(executionBrief));
  return parts.filter(Boolean).join("\n\n");
}

function uiQualityBlock(executionBrief: string): string {
  const req = resolveAppTypeFromPrompt(executionBrief);
  const appType = req?.id ?? null;
  return [
    appTypePromptBlock(appType),
    buildFullUiGenerationBlock({ appType, buildTier: "standard", stylePresetId: "minimal" }),
  ].join("\n");
}

export function buildPlanPrompt(
  executionBrief: string,
  scopeNote: string,
  slices?: BuildContextSlices,
): string {
  const brief = slices
    ? sliceBriefForStage(slices, "build_plan")
    : sliceToTokenBudget(executionBrief, 800);
  const scope = sliceToTokenBudget(scopeNote, 300);
  return [
    JSON_ONLY_RULE,
    buildStageObjective("build_plan"),
    `Execution brief: ${brief}`,
    scope,
    `Return: { "complexity": 1-10, "summary": "", "steps": ["..."], "pages": ["..."], "entities": ["..."], "core_v1_only": boolean, "queued_later": ["..."] }`,
  ].join("\n");
}

export function appIdentityPrompt(
  executionBrief: string,
  planJson: string,
  slices?: BuildContextSlices,
): string {
  const brief = slices
    ? sliceBriefForStage(slices, "app_identity")
    : sliceToTokenBudget(executionBrief, 400);
  return [
    JSON_ONLY_RULE,
    buildStageObjective("app_identity"),
    `Plan: ${sliceToTokenBudget(planJson, 400)}`,
    `Brief: ${brief}`,
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

export function schemaPrompt(planJson: string, slices?: BuildContextSlices): string {
  return [
    JSON_ONLY_RULE,
    buildStageObjective("schema_design"),
    `Plan: ${slices ? slices.planSlice : sliceToTokenBudget(planJson, 600)}`,
    `Return: { "entities": [{ "name": "", "fields": [{ "name": "", "type": "" }] }], "rls_notes": "" }`,
  ].join("\n");
}

export function uiPlanPrompt(
  planJson: string,
  schemaJson: string,
  executionBrief?: string,
  slices?: BuildContextSlices,
  designBrief?: DesignBrief | null,
): string {
  return [
    JSON_ONLY_RULE,
    buildStageObjective("ui_design_plan"),
    productionUiBlock(designBrief, executionBrief),
    `Plan: ${slices ? slices.planSlice : sliceToTokenBudget(planJson, 500)}`,
    `Schema: ${slices ? slices.schemaSlice : sliceToTokenBudget(schemaJson, 400)}`,
    designBrief
      ? `Routes: ${designBrief.routes.join(", ")}`
      : executionBrief
        ? uiQualityBlock(sliceToTokenBudget(executionBrief, 400))
        : "",
    `Return: { "navigation": "", "screens": [{ "id": "", "title": "", "components": [] }], "design_tokens": {} }`,
    "Screens must map 1:1 to routes with rich sections — not a single landing hero.",
  ].join("\n");
}

export function frontendPrompt(
  executionBrief: string,
  planJson: string,
  uiJson: string,
  maxFiles: number,
  slices?: BuildContextSlices,
  designBrief?: DesignBrief | null,
): string {
  const brief = slices
    ? sliceBriefForStage(slices, "frontend_implementation")
    : sliceToTokenBudget(executionBrief, 800);
  return [
    FILE_PAYLOAD_RULE,
    buildStageObjective("frontend_implementation"),
    "You are not generating a simple demo. Ship production-quality UI that looks like a premium SaaS product.",
    productionUiBlock(designBrief, brief),
    `Max ${maxFiles} files. REQUIRED: app/layout.tsx shell, app/page.tsx rich home/dashboard, and feature routes under app/.`,
    "Do NOT return preview-only output — route files under app/ are mandatory.",
    designBrief
      ? `App name: ${designBrief.appName}. Use domain terms: ${designBrief.terminology.join(", ")}.`
      : `Brief: ${brief}`,
    `Plan: ${slices ? slices.planSlice : sliceToTokenBudget(planJson, 500)}`,
    `UI plan: ${slices ? slices.uiSlice : sliceToTokenBudget(uiJson, 400)}`,
    "MOBILE/PWA: Include viewport export, touch-friendly controls (min 44px), overflow-x hidden, safe-area CSS, public/manifest.webmanifest, capacitor.config.ts stub.",
    "INTEGRATIONS: If email/payments/DB/AI are requested, gate features when env secrets missing — show honest disabled state, never fake API success.",
  ].join("\n");
}

export function minimalFrontendPrompt(
  executionBrief: string,
  planJson: string,
  slices?: BuildContextSlices,
  designBrief?: DesignBrief | null,
): string {
  const brief = slices
    ? sliceBriefForStage(slices, "frontend_implementation")
    : sliceToTokenBudget(executionBrief, 600);
  return [
    FILE_PAYLOAD_RULE,
    buildStageObjective("frontend_implementation"),
    "Return EXACTLY 5 files with complete JSX (concise but premium):",
    "1) package.json — next/react deps with dev/build/start scripts",
    "2) app/layout.tsx — root shell with sidebar or top nav + Tailwind",
    "3) app/page.tsx — rich dashboard (metrics + table/panel + actions) — NOT welcome-only",
    "4) app/dashboard/page.tsx OR primary feature route — data table/cards",
    "5) app/[feature]/page.tsx — second feature screen with realistic mock data",
    productionUiBlock(designBrief, brief),
    designBrief ? `Routes: ${designBrief.routes.slice(0, 4).join(", ")}` : `Brief: ${brief}`,
    `Plan: ${slices ? slices.planSlice : sliceToTokenBudget(planJson, 400)}`,
  ].join("\n");
}

export function backendPrompt(planJson: string, schemaJson: string, slices?: BuildContextSlices): string {
  return [
    FILE_PAYLOAD_RULE,
    buildStageObjective("backend_implementation"),
    "Generate API routes, server actions, or lib modules only if needed.",
    `Plan: ${slices ? slices.planSlice : sliceToTokenBudget(planJson, 500)}`,
    `Schema: ${slices ? slices.schemaSlice : sliceToTokenBudget(schemaJson, 400)}`,
  ].join("\n");
}
