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

must("src/lib/projects/project-visibility-status.ts", "computeProjectCardUiState", "ui state helper");
must("src/lib/projects/project-visibility-status.ts", "isMainAppsListProject", "main list filter");
must("src/app/api/home/recent-projects/route.ts", "visibility_section", "home API visibility");
must("src/app/api/projects/route.ts", "visibility_section", "projects API visibility");

console.log("\n=== verify:project-visibility-status ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
