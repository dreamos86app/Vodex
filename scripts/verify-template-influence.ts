import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { getTemplateDataModel } from "../src/lib/templates/template-data-models";
import { getTemplateFilePlan } from "../src/lib/templates/template-file-plans";
import { CORE_TEMPLATES } from "../src/lib/templates/template-archetypes";

const errors: string[] = [];

const crm = buildDeterministicBlueprint({ prompt: "CRM", templateId: "crm" });
const finance = buildDeterministicBlueprint({ prompt: "Finance", templateId: "finance-app" });
if (JSON.stringify(crm.routeMap) === JSON.stringify(finance.routeMap)) {
  errors.push("CRM vs finance route maps must differ");
}

const crmModel = getTemplateDataModel("crm");
const finModel = getTemplateDataModel("finance-app");
if (JSON.stringify(crmModel) === JSON.stringify(finModel)) {
  errors.push("CRM vs finance data models must differ");
}

const market = buildDeterministicBlueprint({ prompt: "Marketplace", templateId: "marketplace" });
if (!JSON.stringify(market).toLowerCase().includes("listing")) {
  errors.push("Marketplace template should influence flows");
}

const mobile = buildDeterministicBlueprint({ prompt: "Habit tracker", templateId: "mobile-habit" });
if (!mobile.mobileStrategy && !mobile.responsiveStrategy) {
  errors.push("Mobile template should set mobile strategy");
}

if (CORE_TEMPLATES.length < 15) errors.push("Need 15 core templates");

const crmFiles = getTemplateFilePlan("crm");
if (!crmFiles.some((f) => f.includes("page.tsx"))) errors.push("CRM file plan missing routes");

if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ template influence OK");
