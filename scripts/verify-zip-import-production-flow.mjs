#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const wizard = fs.readFileSync(path.join(root, "src/components/apps/zip-import-wizard.tsx"), "utf8");
const classification = fs.readFileSync(path.join(root, "src/lib/import/zip-scan-classification.ts"), "utf8");

if (!classification.includes("mobile_packaging")) {
  console.error("✗ zip scan classification missing mobile_packaging");
  process.exit(1);
}
if (!wizard.includes("webPreviewReady") || !wizard.includes("splitZipScanBlockers")) {
  console.error("✗ zip wizard missing production flow blockers");
  process.exit(1);
}
if (wizard.includes("Android package ID") && wizard.includes("Mobile packaging")) {
  console.log("✓ mobile packaging separated from web preview");
}
console.log("✓ verify:zip-import-production-flow passed");
