#!/usr/bin/env node
/**
 * Verifies P4.0 mobile tables exist (local migration file + optional live probe).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mig = fs.readFileSync(
  path.join(root, "supabase/migrations/20260811120000_p40_mobile_infrastructure.sql"),
  "utf8",
);
const errors = [];

for (const needle of [
  "mobile_build_jobs",
  "mobile_app_configs",
  "build_type",
  "builder_id",
  "sha_keys",
  "readiness_state",
  "claim_mobile_build_job",
  "android_builder_heartbeats",
]) {
  if (!mig.includes(needle)) errors.push(`migration missing ${needle}`);
}

if (errors.length) {
  console.error("verify:p40-mobile-db FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:p40-mobile-db OK (migration file)");
