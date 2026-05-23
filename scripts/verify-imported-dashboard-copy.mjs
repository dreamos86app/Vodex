#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dash = fs.readFileSync(path.join(root, "src/components/create/workspace/app-dashboard-panel.tsx"), "utf8");
const immersive = fs.readFileSync(path.join(root, "src/components/create/workspace/immersive-workspace.tsx"), "utf8");

const bad = [
  "Run a build to generate pages",
  "Data model will appear after a successful build",
  "Start your build",
];

let failed = false;
for (const phrase of bad) {
  if (isZipImportGuarded(dash, phrase) && isZipImportGuarded(immersive, phrase)) {
    console.log("✓ imported guard for:", phrase);
  } else if (dash.includes(phrase) && !dash.includes("isZipImport")) {
    console.warn("⚠ phrase may show for imports:", phrase);
  }
}

if (dash.includes("Imported app ready") || immersive.includes("Imported app ready")) {
  console.log("✓ imported ready copy");
} else {
  console.error("✗ missing imported ready copy");
  failed = true;
}

if (dash.includes("Advanced mode") || dash.includes("Advanced")) {
  console.log("✓ simple/advanced dashboard");
} else {
  console.error("✗ advanced toggle");
  failed = true;
}

function isZipImportGuarded(content, phrase) {
  if (!content.includes(phrase)) return true;
  const idx = content.indexOf(phrase);
  const window = content.slice(Math.max(0, idx - 200), idx + 200);
  return window.includes("isZipImport");
}

process.exit(failed ? 1 : 0);
