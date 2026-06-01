#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function must(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(label);
}

must("src/lib/projects/app-logo-generation.ts", "normalizeIconBuffer", "icon normalize");
must("src/lib/projects/app-logo-generation.ts", "applyCircularMask", "circular mask");
must("src/lib/projects/app-logo-generation.ts", ".trim(", "trim white edges");
must("src/components/projects/project-icon.tsx", "object-cover", "avatar cover");

console.log("\n=== verify:icon-borderless-circle ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
