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

must("src/app/globals.css", "workflow-gold-pulse", "gold pulse keyframes");
must("src/app/globals.css", "workflow-active-ring", "step active ring");
must("src/app/globals.css", "file-active-ring", "file active ring");
must("src/components/create/workspace/workflow-step-card.tsx", "workflow-active-ring", "step card ring");
must("src/components/create/workspace/agent-workflow-stream.tsx", "file-active-ring", "file row ring");

console.log("\n=== verify:gold-outline-workflow ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
