#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const must = [
  "src/components/import/imported-secrets-setup-panel.tsx",
  "src/app/api/projects/[id]/secrets/route.ts",
  "src/lib/secrets/seal.ts",
  "src/lib/import/env-requirement-detector.ts",
];

let failed = false;
for (const f of must) {
  if (!fs.existsSync(path.join(root, f))) {
    console.error("✗ missing", f);
    failed = true;
  } else console.log("✓", f);
}

const panel = fs.readFileSync(path.join(root, "src/components/import/imported-secrets-setup-panel.tsx"), "utf8");
for (const needle of ["type=\"password\"", "Submit all", "never imported", "Ask AI to help"]) {
  if (!panel.includes(needle)) {
    console.error("✗ panel missing", needle);
    failed = true;
  }
}
if (!failed) console.log("✓ secrets setup panel UX");

const det = fs.readFileSync(path.join(root, "src/lib/import/env-requirement-detector.ts"), "utf8");
if (!det.includes("IMPORT_META_RE") || !det.includes("VITE_RE")) {
  console.error("✗ env detector missing Vite/import.meta patterns");
  failed = true;
} else console.log("✓ env detection patterns");

process.exit(failed ? 1 : 0);
