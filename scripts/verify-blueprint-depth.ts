/**
 * Runtime blueprint depth tests — archetypes, templates, scoring.
 */
import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { scoreBlueprint } from "../src/lib/build/blueprint-scoring";
import { buildBackendPlan } from "../src/lib/build/backend-plan";
import { buildDatabaseDepthPlan } from "../src/lib/build/database-depth-plan";

const errors: string[] = [];
const ok: string[] = [];

function assert(cond: boolean, msg: string) {
  (cond ? ok : errors).push(msg);
}

function routesOf(bp: ReturnType<typeof buildDeterministicBlueprint>): string {
  return JSON.stringify(bp.routeMap ?? bp.pages ?? []);
}

// CRM
const crm = buildDeterministicBlueprint({
  prompt: "Build a CRM for sales teams with contacts, deals, and follow-up tasks",
  templateId: "crm",
});
assert(routesOf(crm).includes("/contacts"), "CRM blueprint includes contacts route");
assert(routesOf(crm).includes("/deals"), "CRM blueprint includes deals route");
assert(
  (crm.dataModel ?? []).some((t) => t.name === "contacts" || t.name === "deals"),
  "CRM data model includes contacts/deals",
);

// Booking
const booking = buildDeterministicBlueprint({
  prompt: "Salon booking with services, time slots, and reminders",
  templateId: "booking-app",
});
assert(
  JSON.stringify(booking).toLowerCase().includes("book") ||
    (booking.dataModel ?? []).some((t) => /service|booking|slot/i.test(t.name)),
  "Booking blueprint includes booking/services",
);

// Finance
const finance = buildDeterministicBlueprint({
  prompt: "Personal finance app with accounts, transactions, and categories",
  templateId: "finance-app",
});
assert(
  (finance.dataModel ?? []).some((t) => /transaction|account|category/i.test(t.name)),
  "Finance data model includes accounts/transactions/categories",
);

// AI tool
const ai = buildDeterministicBlueprint({
  prompt: "AI writing assistant with prompt input, output, and history",
  templateId: "ai-assistant",
});
assert(
  JSON.stringify(ai).toLowerCase().includes("chat") ||
    JSON.stringify(ai).toLowerCase().includes("history") ||
    JSON.stringify(ai).toLowerCase().includes("message"),
  "AI tool blueprint includes prompt/history flows",
);

// Marketplace
const market = buildDeterministicBlueprint({
  prompt: "Marketplace with listings, search, seller and buyer flows",
  templateId: "marketplace",
});
assert(
  routesOf(market).includes("listing") || routesOf(market).includes("search"),
  "Marketplace blueprint includes listing/search flows",
);

// Not generic
const crmScore = scoreBlueprint(crm);
assert(crmScore.total >= 75, `CRM blueprint score >= 75 (got ${crmScore.total})`);
assert(crmScore.appSpecificRelevance >= 60, "CRM blueprint app-specific relevance");

// Template influence
const crmTpl = buildDeterministicBlueprint({ prompt: "CRM app", templateId: "crm" });
const finTpl = buildDeterministicBlueprint({ prompt: "CRM app", templateId: "finance-app" });
assert(routesOf(crmTpl) !== routesOf(finTpl), "Blueprint changes when template changes");

// Style influence
const styled = buildDeterministicBlueprint({
  prompt: "SaaS dashboard",
  templateId: "dashboard",
  stylePresetId: "bold",
});
const plain = buildDeterministicBlueprint({
  prompt: "SaaS dashboard",
  templateId: "dashboard",
  stylePresetId: "minimal",
});
assert(
  styled.designDirection !== plain.designDirection || styled.styleInfluence !== plain.styleInfluence,
  "Blueprint reflects style preset",
);

// Backend plan
const crmBackend = buildBackendPlan(crm);
assert(
  crmBackend.entities.some((e) => /contact|deal|task/i.test(e.name)),
  "CRM backend plan includes contacts/deals/tasks",
);
assert(crmBackend.honestLimitations.some((l) => /mock|preview/i.test(l)), "Backend plan honest about preview");

// DB depth
const dbPlan = buildDatabaseDepthPlan(crm);
assert(dbPlan.rlsPolicies.length > 0 || dbPlan.tables.length > 0, "DB depth plan has RLS or tables");

// Scoring dimensions
assert(crmScore.routeCompleteness >= 70, "Route completeness scored");
assert(crmScore.acceptanceCriteriaQuality >= 50, "Acceptance criteria scored");

console.log("\n=== verify:blueprint (depth) ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
