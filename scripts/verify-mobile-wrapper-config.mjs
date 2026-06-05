#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/mobile/capacitor-generator.ts", "capacitor.config.ts", "capacitor config generated");
must("src/lib/mobile/capacitor-generator.ts", "generateCapacitorWrapperProject", "wrapper generator");
must("src/app/api/projects/[id]/mobile/config/route.ts", "splash_duration_ms", "config accepts splash duration");
must("src/lib/mobile/package-validation.ts", "com.vodex", "vodex package ids");

if (errors.length) {
  console.error("verify:mobile-wrapper-config FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:mobile-wrapper-config OK");
