#!/usr/bin/env node
/**
 * Audit canonical credit state vs legacy fields for all profiles.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const PLAN_BUILD = { free: 20, starter: 185, pro: 475, business: 475, infinity: 975, enterprise: 975 };
const PLAN_ACTION = { free: 20, starter: 420, pro: 1125, business: 1125, infinity: 2350, enterprise: 2350 };

function bonus(available, allowance) {
  return Math.max(0, Math.round((available - allowance) * 10) / 10);
}

async function main() {
  const { data: profiles, error } = await admin.from("profiles").select("id,email,plan_id,credits_remaining");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { data: actionRows } = await admin
    .from("action_credit_balances")
    .select("owner_user_id,balance")
    .is("project_id", null);

  const actionByUser = new Map((actionRows ?? []).map((r) => [r.owner_user_id, Number(r.balance)]));

  console.log("\n=== audit:credits ===\n");
  let mismatches = 0;

  for (const p of profiles ?? []) {
    const plan = p.plan_id ?? "free";
    const buildAllowance = PLAN_BUILD[plan] ?? 20;
    const actionAllowance = PLAN_ACTION[plan] ?? 25;
    const buildAvailable = Number(p.credits_remaining ?? buildAllowance);
    const actionAvailable = actionByUser.has(p.id) ? actionByUser.get(p.id) : actionAllowance;
    const buildBonus = bonus(buildAvailable, buildAllowance);
    const actionBonus = bonus(actionAvailable, actionAllowance);

    const line = {
      email: p.email,
      plan,
      buildAvailable,
      buildAllowance,
      buildBonus,
      actionAvailable,
      actionAllowance,
      actionBonus,
      uiBuild: `${buildAvailable} / ${buildAllowance}`,
      uiAction: `${actionAvailable} / ${actionAllowance}`,
    };

    const suspicious = buildBonus > 0 && !p.email?.includes("e2e");
    if (suspicious && buildAvailable > buildAllowance + 10) {
      mismatches += 1;
      console.log("⚠ suspicious high build balance", line);
    } else {
      console.log("✓", p.email, "| build:", line.uiBuild, buildBonus ? `(+${buildBonus})` : "", "| action:", line.uiAction, actionBonus ? `(+${actionBonus})` : "");
    }
  }

  console.log(`\nProfiles: ${profiles?.length ?? 0} | flagged: ${mismatches}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
