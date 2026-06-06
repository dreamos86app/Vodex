#!/usr/bin/env node
/**
 * npm run e2e:credits:prepare — grant deterministic credits for live E2E user only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  allowE2eCreditPrepare,
  E2E_MIN_ACTION_CREDITS,
  E2E_MIN_BUILD_CREDITS,
} from "./lib/e2e-credit-thresholds.mjs";
import { resolveE2eUserEmail } from "./lib/e2e-live.mjs";
import { writeE2eCreditsMarker } from "./lib/e2e-credits-marker.mjs";

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

// Guard: blocks VERCEL_ENV=production unless E2E_RUN_LIVE=1 (see allowE2eCreditPrepare).
if (!allowE2eCreditPrepare(env)) {
  console.error(
    "e2e:credits:prepare blocked in production. Set E2E_RUN_LIVE=1 for intentional live runs only.",
  );
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
const email = resolveE2eUserEmail(env);

if (!url || !key) {
  console.error("E2E_CREDITS_INSUFFICIENT: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email) {
  console.error(
    "E2E_CREDITS_INSUFFICIENT: set E2E_TEST_EMAIL in .env.local or refresh .playwright-auth.json",
  );
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: profile, error: profErr } = await admin
  .from("profiles")
  .select("id, email, credits_remaining, plan_id, metadata")
  .eq("email", email)
  .maybeSingle();

if (profErr || !profile?.id) {
  console.error(
    `E2E_CREDITS_INSUFFICIENT: no profile for ${email} — ${profErr?.message ?? "not found"}`,
  );
  process.exit(1);
}

const userId = profile.id;

const prevMeta =
  profile.metadata && typeof profile.metadata === "object" && !Array.isArray(profile.metadata)
    ? profile.metadata
    : {};

const { error: onboardErr } = await admin
  .from("profiles")
  .update({ onboarding_completed: true, onboarding_step: 4 })
  .eq("id", userId);
if (onboardErr) {
  console.warn(`[e2e:credits:prepare] onboarding flag update: ${onboardErr.message}`);
}

const prevBuild = Number(profile.credits_remaining ?? 0);
const targetBuild = Math.max(prevBuild, E2E_MIN_BUILD_CREDITS);

const { error: buildErr } = await admin
  .from("profiles")
  .update({ credits_remaining: targetBuild })
  .eq("id", userId);

if (buildErr) {
  console.error(`E2E_CREDITS_INSUFFICIENT: build credits update failed — ${buildErr.message}`);
  process.exit(1);
}

const grantDelta = Math.max(0, targetBuild - prevBuild);
if (grantDelta > 0) {
  const { error: ledgerErr } = await admin.from("token_ledger").insert({
    user_id: userId,
    amount: grantDelta,
    source: "admin_grant",
    metadata: { via: "grant_credits_admin", e2e: true, e2e_marker: "e2e_credits_prepare" },
  });
  if (ledgerErr) {
    console.warn(`[e2e:credits] token_ledger grant note failed: ${ledgerErr.message}`);
  }
}

const { error: auditErr } = await admin.from("admin_audit_logs").insert({
  admin_user_id: userId,
  action: "e2e_credits_prepare",
  target_user_id: userId,
  after_state: {
    build_credits: targetBuild,
    action_credits: E2E_MIN_ACTION_CREDITS,
  },
  metadata: {
    email,
    e2e_marker: "e2e_credits_prepare",
  },
});
if (auditErr) {
  console.warn(`[e2e:credits] admin_audit_logs: ${auditErr.message}`);
}

const { error: rpcErr } = await admin.rpc("ensure_action_credit_balance", {
  p_owner_user_id: userId,
  p_project_id: null,
  p_initial: E2E_MIN_ACTION_CREDITS,
});
if (rpcErr) {
  console.warn(`[e2e:credits] ensure_action_credit_balance: ${rpcErr.message}`);
}

const { data: actionRows } = await admin
  .from("action_credit_balances")
  .select("id, balance")
  .eq("owner_user_id", userId)
  .is("project_id", null);

const prevAction = Math.max(0, ...(actionRows ?? []).map((r) => Number(r.balance ?? 0)));
const targetAction = Math.max(prevAction, E2E_MIN_ACTION_CREDITS);

if ((actionRows ?? []).length > 0) {
  const { error: actErr } = await admin
    .from("action_credit_balances")
    .update({ balance: targetAction, updated_at: new Date().toISOString() })
    .eq("owner_user_id", userId)
    .is("project_id", null);
  if (actErr) {
    console.error(`E2E_CREDITS_INSUFFICIENT: action credits update failed — ${actErr.message}`);
    process.exit(1);
  }
} else {
  const { error: insErr } = await admin.from("action_credit_balances").insert({
    owner_user_id: userId,
    project_id: null,
    balance: targetAction,
  });
  if (insErr) {
    console.error(`E2E_CREDITS_INSUFFICIENT: action credits insert failed — ${insErr.message}`);
    process.exit(1);
  }
}

await admin
  .from("profiles")
  .update({
    metadata: {
      ...prevMeta,
      e2e_test_credit_grant: new Date().toISOString(),
      e2e_credit_prepare_action: targetAction,
      e2e_credit_prepare_build: targetBuild,
    },
  })
  .eq("id", userId);

console.log("\n=== e2e:credits:prepare ===\n");
console.log(`✓ user: ${email}`);
console.log("✓ onboarding_completed flag set on profile");
console.log(`✓ build credits: ${prevBuild} → ${targetBuild} (min ${E2E_MIN_BUILD_CREDITS})`);
console.log(`✓ action credits: ${prevAction} → ${targetAction} (min ${E2E_MIN_ACTION_CREDITS})`);
writeE2eCreditsMarker({
  userId,
  email,
  buildCredits: targetBuild,
  actionCredits: targetAction,
  preparedAt: new Date().toISOString(),
});
console.log("✓ wrote .e2e-credits-prepared.json marker\n");
