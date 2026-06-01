/**
 * Verify actor-pays-by-default workspace credit billing architecture.
 * Run: npm run verify:workspace-credit-billing
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];

  const migration = await read("supabase/migrations/20260601140000_workspace_billing_mode.sql");
  if (!migration.includes("billing_mode")) {
    errors.push("billing migration must add workspaces.billing_mode");
  }
  if (!migration.includes("personal_credits")) {
    errors.push("billing migration default must be personal_credits");
  }
  if (!migration.includes("actor_user_id")) {
    errors.push("billing migration must extend ai_usage_logs with actor_user_id");
  }

  const resolver = await read("src/lib/billing/workspace-credit-billing.ts");
  if (!resolver.includes('billedUserId: actorUserId')) {
    errors.push("resolver must default billed user to actor (personal_credits)");
  }
  if (!resolver.includes("workspace_sponsored")) {
    errors.push("resolver must support workspace_sponsored mode");
  }
  if (!resolver.includes("hybrid")) {
    errors.push("resolver must support hybrid mode");
  }

  const charge = await read("src/lib/credits/charge-ai-operation.ts");
  if (!charge.includes("resolveCreditBillingTarget")) {
    errors.push("chargeAiOperation must call resolveCreditBillingTarget");
  }
  if (!charge.includes("actor_user_id")) {
    errors.push("chargeAiOperation must log actor_user_id on usage");
  }
  if (!charge.includes("billed_to_type")) {
    errors.push("chargeAiOperation must log billed_to_type");
  }

  const reserve = await read("src/lib/billing/credit-reservations.ts");
  if (!reserve.includes("resolveCreditBillingTarget")) {
    errors.push("reserveCreditsForGeneration must resolve billing server-side");
  }

  const chat = await read("src/app/api/chat/route.ts");
  if (!chat.includes("assertProjectAccess")) {
    errors.push("chat route must use assertProjectAccess for collaborators");
  }
  if (!chat.includes("actorUserId: user.id")) {
    errors.push("chat route must pass actorUserId to charge/reserve");
  }

  const billingApi = await read("src/app/api/workspaces/[workspaceId]/billing/route.ts");
  if (!billingApi.includes("personal_credits")) {
    errors.push("workspace billing API must expose billing modes");
  }

  const diag = await read("scripts/diagnose-workspace-schema.sql");
  if (!diag.includes("to_regclass('public.team_members')")) {
    errors.push("diagnostic SQL must guard team_members with to_regclass");
  }
  if (diag.toLowerCase().includes("from public.team_members") && !diag.includes("is not null")) {
    const unsafe = /from\s+public\.team_members/gi.test(diag.replace(/is not null[\s\S]*?from public\.team_members/gi, ""));
    if (unsafe) {
      errors.push("diagnostic SQL must not SELECT from team_members without existence guard");
    }
  }

  if (errors.length) {
    console.error("verify:workspace-credit-billing FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }

  console.log("verify:workspace-credit-billing OK");
  console.log("  Default: acting user pays (personal_credits)");
  console.log("  Optional: workspace_sponsored + hybrid on workspaces.billing_mode");
  console.log("  Server: chargeAiOperation + reserveCredits resolve billed user");
  console.log("  Logs: ai_usage_logs actor_user_id + billed_to_type");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
