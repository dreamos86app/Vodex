#!/usr/bin/env node
/**
 * ZIP import structure + runtime validator tests.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

[
  "src/lib/import/zip-import-service.ts",
  "src/lib/import/zip-file-validator.ts",
  "src/lib/import/framework-detector.ts",
  "src/lib/import/package-script-detector.ts",
  "src/lib/import/dependency-detector.ts",
  "src/lib/import/env-requirement-detector.ts",
  "src/lib/import/imported-app-validator.ts",
  "src/lib/import/import-quality-score.ts",
  "src/app/api/projects/import-zip/route.ts",
  "src/app/api/import/zip/preview/route.ts",
  "src/components/import/imported-app-view.tsx",
  "src/components/apps/zip-import-wizard.tsx",
  "src/components/create/workspace/app-dashboard-panel.tsx",
].forEach(mustExist);

const validator = fs.readFileSync(path.join(root, "src/lib/import/zip-file-validator.ts"), "utf8");
if (validator.includes("isSecretZipPath") && validator.includes(".env")) ok.push(".env excluded from import");
else errors.push("missing .env secret exclusion");

if (validator.includes("node_modules")) ok.push("node_modules skipped");
else errors.push("missing node_modules skip");

if (validator.includes("1500")) ok.push("1500 file limit");
else errors.push("missing 1500 file limit");

if (fs.readFileSync(path.join(root, "src/lib/import/zip-import-service.ts"), "utf8").includes("scanProviderCostUsd: 0")) {
  ok.push("deterministic scan no LLM cost");
} else {
  errors.push("zip-import-service must not charge for scan");
}

const route = fs.readFileSync(path.join(root, "src/app/api/projects/import-zip/route.ts"), "utf8");
if (route.includes("extractAndAnalyzeZip") && route.includes("quality_score")) ok.push("import route uses service + quality score");
else errors.push("import route not wired to zip-import-service");

if (route.includes('source: "zip_import"')) ok.push("project metadata source zip_import");
else errors.push("missing zip_import source metadata");

const panel = fs.readFileSync(path.join(root, "src/components/create/workspace/app-dashboard-panel.tsx"), "utf8");
if (panel.includes("ImportedAppView") && panel.includes("Open builder")) ok.push("dashboard import + actions");
else errors.push("dashboard missing import view or continue actions");

if (route.includes("ensurePrivateBucket") && route.includes("ZIP_IMPORT_BUCKET")) ok.push("import route private zip-imports bucket");
else errors.push("import route must ensure private zip-imports bucket");

if (route.includes('.from("media")')) errors.push("import route must not upload ZIP to media bucket");
else ok.push("import route avoids media bucket for ZIP");

if (route.includes("buildZipImportAppFileRows")) ok.push("import route app_files row builder");
else errors.push("import route must use buildZipImportAppFileRows");

const appFilesTest = spawnSync("npx", ["tsx", path.join(root, "scripts/test-app-files-rows.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (appFilesTest.status === 0) ok.push("app_files row helper tests");
else {
  errors.push("app_files row helper tests failed");
  if (appFilesTest.stdout) console.log(appFilesTest.stdout);
  if (appFilesTest.stderr) console.error(appFilesTest.stderr);
}

const storageTest = spawnSync("npx", ["tsx", path.join(root, "scripts/test-zip-storage.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (storageTest.status === 0) ok.push("zip storage helper tests");
else {
  errors.push("zip storage helper tests failed");
  if (storageTest.stdout) console.log(storageTest.stdout);
  if (storageTest.stderr) console.error(storageTest.stderr);
}

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/test-zip-import.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status === 0) ok.push("zip import runtime tests");
else {
  errors.push("zip import runtime tests failed");
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
}

console.log("\n=== verify:zip-import ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
