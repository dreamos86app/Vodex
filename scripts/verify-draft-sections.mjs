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

must("src/components/os-home/drafts-section.tsx", "drafts-section", "home drafts section");
must("src/components/os-home/os-home.tsx", "DraftsSection", "home uses drafts");
must("src/components/apps/projects-view.tsx", "apps-drafts-section", "apps drafts section");
must("src/lib/projects/project-visibility-status.ts", "visibility_section", "visibility sections");

console.log("\n=== verify:draft-sections ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
