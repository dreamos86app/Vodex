import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { scoreBlueprint } from "../src/lib/build/blueprint-scoring";
import { buildBackendPlan } from "../src/lib/build/backend-plan";
import { detectBackendRequired } from "../src/lib/build/backend-plan";
import fs from "node:fs";
import path from "node:path";

const benchPath = path.join(process.cwd(), "benchmarks/prompts/benchmark-50.json");
const doc = JSON.parse(fs.readFileSync(benchPath, "utf8"));
const prompts = doc.prompts ?? [];

const templateByType: Record<string, string> = {
  landing: "saas-landing",
  dashboard: "analytics-dashboard",
  saas: "dashboard",
  crm: "crm",
  booking: "booking-app",
  mobile_first: "mobile-habit",
  ai_tool: "ai-assistant",
};

function resolveTemplateId(appType: string, prompt: string): string {
  const base = templateByType[appType] ?? "saas-landing";
  const p = prompt.toLowerCase();
  if (appType === "saas" && /\b(landing|marketing|waitlist)\b/.test(p)) return "saas-landing";
  if (appType === "dashboard" && /\b(support|ticket|helpdesk)\b/.test(p)) return "support-helpdesk";
  if (appType === "dashboard" && /\b(inventory|warehouse|supplier)\b/.test(p)) return "internal-tool";
  return base;
}

let blueprintSum = 0;
let templateHits = 0;
let backendNeeded = 0;
let backendComplete = 0;

const styleByType: Record<string, string> = {
  landing: "bold",
  dashboard: "enterprise",
  saas: "minimal",
  crm: "enterprise",
  booking: "minimal",
  mobile_first: "bold",
  ai_tool: "glass",
};

for (const p of prompts) {
  const templateId = resolveTemplateId(p.appType, p.text);
  const bp = buildDeterministicBlueprint({
    prompt: p.text,
    templateId,
    stylePresetId: styleByType[p.appType] ?? "minimal",
  });
  const scored = scoreBlueprint(bp);
  blueprintSum += scored.total;
  if (bp.templateId === templateId || bp.templateInfluence) templateHits += 1;
  const needsBackend = detectBackendRequired(bp);
  if (needsBackend) {
    backendNeeded += 1;
    const plan = buildBackendPlan(bp);
    const complete =
      plan.honestLimitations.length > 0 &&
      plan.userConfigurationChecklist.length > 0 &&
      (plan.entities.length > 0 || plan.crudActions.length > 0);
    if (complete) backendComplete += 1;
  }
}

const out = {
  averageBlueprintScore: prompts.length ? Math.round((blueprintSum / prompts.length) * 10) / 10 : 0,
  templateInfluenceRate: prompts.length ? templateHits / prompts.length : 0,
  backendPlanCompleteness: backendNeeded ? backendComplete / backendNeeded : 1,
  promptCount: prompts.length,
};

console.log(JSON.stringify(out, null, 2));
