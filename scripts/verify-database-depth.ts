import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { buildDatabaseDepthPlan } from "../src/lib/build/database-depth-plan";

const bp = buildDeterministicBlueprint({
  prompt: "CRM with auth and user-owned contacts",
  templateId: "crm",
});
const plan = buildDatabaseDepthPlan(bp);
const errors: string[] = [];

if (plan.tables.length === 0) errors.push("CRM should have tables");
if (!plan.migrationHonesty.toLowerCase().includes("preview")) {
  errors.push("Must be honest about preview vs live migrations");
}
if (bp.authModel && plan.rlsPolicies.length === 0) {
  errors.push("Auth blueprint should include RLS expectations");
}

if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ database depth OK");
