#!/usr/bin/env node
/**
 * Repair profiles where credits_remaining was inflated by old SQL quotas
 * or inferred as fake bonus (available - planAllowance).
 *
 * Usage: node scripts/repair-plan-credit-bonus.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const PLAN_ALLOWANCE = {
  free: 20,
  starter: 185,
  pro: 475,
  business: 500,
  infinity: 1000,
  enterprise: 1000,
};

function allowance(plan) {
  return PLAN_ALLOWANCE[plan] ?? 20;
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: profiles, error } = await admin
  .from("profiles")
  .select("id, email, plan_id, credits_remaining");

if (error) {
  console.error(error.message);
  process.exit(1);
}

let fixed = 0;
for (const row of profiles ?? []) {
  const plan = row.plan_id ?? "free";
  const quota = allowance(plan);

  const { data: grants } = await admin
    .from("token_ledger")
    .select("amount, source, metadata")
    .eq("user_id", row.id)
    .gt("amount", 0);

  const explicitBonus = (grants ?? []).reduce((sum, g) => {
    const src = String(g.source ?? "");
    if (["admin_grant", "referral", "grant", "purchase", "top_up"].includes(src)) {
      return sum + (Number(g.amount) || 0);
    }
    if (src === "adjustment") {
      const meta = g.metadata && typeof g.metadata === "object" ? g.metadata : {};
      if (meta.via === "grant_credits_admin" || meta.via === "grant_credits") {
        return sum + (Number(g.amount) || 0);
      }
    }
    return sum;
  }, 0);

  const target = quota + explicitBonus;
  const current = Number(row.credits_remaining) || 0;
  const inferredFakeBonus = Math.max(0, current - quota - explicitBonus);

  if (inferredFakeBonus <= 0 && current <= target + 0.01) continue;

  const next = Math.min(current, target);
  console.log(
    `${dryRun ? "[dry-run] " : ""}${row.email ?? row.id}: plan=${plan} ${current} → ${next} (quota=${quota}, bonus=${explicitBonus}, removed_fake=${Math.max(0, current - next)})`,
  );

  if (!dryRun) {
    await admin.from("profiles").update({ credits_remaining: next }).eq("id", row.id);
  }
  fixed += 1;
}

console.log(`\nDone. ${fixed} profile(s) ${dryRun ? "would be" : ""} normalized.`);
