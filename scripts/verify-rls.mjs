#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");
const errors = [];
const ok = [];

/** Tables requiring RLS. snapshot_files is a jsonb column on published_apps/preview_sessions. */
const RLS_TABLES = [
  "projects",
  "app_files",
  "pending_diffs",
  "project_deployments",
  "published_apps",
  "preview_sessions",
  "credit_quotes",
  "credit_reservations",
  "provider_usage_logs",
  "generation_cost_audits",
  "admin_audit_logs",
];

let migrationText = "";
if (fs.existsSync(migrationsDir)) {
  for (const f of fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql"))) {
    migrationText += fs.readFileSync(path.join(migrationsDir, f), "utf8") + "\n";
  }
} else {
  errors.push("supabase/migrations missing");
}

const SERVICE_ROLE_ONLY_TABLES = new Set(["admin_audit_logs"]);

for (const table of RLS_TABLES) {
  const enableRe = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
  const policyRe = new RegExp(`on\\s+public\\.${table}\\s+for`, "i");
  if (!enableRe.test(migrationText)) {
    errors.push(`${table}: RLS not enabled in migrations`);
  } else if (!policyRe.test(migrationText) && !SERVICE_ROLE_ONLY_TABLES.has(table)) {
    errors.push(`${table}: no policy found in migrations`);
  } else {
    ok.push(
      `${table} RLS${SERVICE_ROLE_ONLY_TABLES.has(table) ? " (service-role only)" : " + policy"}`,
    );
  }
}

const snapshotStrip =
  fs.existsSync(path.join(root, "src/lib/publish/publish-service.ts")) &&
  fs.readFileSync(path.join(root, "src/lib/publish/publish-service.ts"), "utf8").includes("stripSecretsFromFiles");
if (snapshotStrip) ok.push("snapshot_files stripped via stripSecretsFromFiles on publish");
else errors.push("publish snapshot secret stripping missing");

console.log("\n=== verify:rls ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
