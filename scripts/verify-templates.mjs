#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

[
  "src/lib/templates/template-catalog.ts",
  "src/lib/templates/template-archetypes.ts",
  "src/lib/templates/template-blueprints.ts",
  "src/lib/templates/template-data-models.ts",
  "src/lib/templates/template-file-plans.ts",
  "src/lib/templates/template-ui-patterns.ts",
].forEach(mustExist);

const arch = fs.readFileSync(path.join(root, "src/lib/templates/template-archetypes.ts"), "utf8");
const required = [
  "saas-landing",
  "ai-assistant",
  "marketplace",
  "booking-app",
  "social-platform",
  "finance-app",
  "crm",
  "dashboard",
  "ecommerce-mini",
  "mobile-habit",
  "portfolio",
  "internal-tool",
  "learning-course",
  "support-helpdesk",
  "analytics-dashboard",
];
for (const id of required) {
  if (arch.includes(`id: "${id}"`)) ok.push(`template ${id}`);
  else errors.push(`missing template ${id}`);
}

if (arch.includes("blueprintFromTemplate") && arch.includes("defaultDataModel")) {
  ok.push("templates wire data model + blueprint");
} else {
  errors.push("template archetypes missing blueprint wiring");
}

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/verify-template-influence.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status === 0) ok.push("template influence runtime tests");
else {
  errors.push("template influence tests failed");
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
}

console.log("\n=== verify:templates ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
