import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { buildBackendPlan } from "../src/lib/build/backend-plan";

const cases: Array<{ name: string; prompt: string; templateId: string; expect: RegExp }> = [
  { name: "CRM", prompt: "CRM", templateId: "crm", expect: /contact|deal|task/i },
  { name: "Booking", prompt: "Booking", templateId: "booking-app", expect: /book|service|slot/i },
  { name: "Finance", prompt: "Finance", templateId: "finance-app", expect: /transaction|account|category/i },
  { name: "Marketplace", prompt: "Marketplace", templateId: "marketplace", expect: /listing|order/i },
  { name: "Admin", prompt: "Admin panel", templateId: "dashboard", expect: /user|audit|metric/i },
];

const errors: string[] = [];
for (const c of cases) {
  const bp = buildDeterministicBlueprint({ prompt: c.prompt, templateId: c.templateId });
  const plan = buildBackendPlan(bp);
  const blob = JSON.stringify(plan.entities) + plan.crudActions.join(" ");
  if (!c.expect.test(blob)) errors.push(`${c.name} backend plan missing expected entities`);
  if (!plan.honestLimitations.some((l) => /mock|preview|configuration/i.test(l))) {
    errors.push(`${c.name} must not fake live backend`);
  }
}

if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ backend depth OK");
