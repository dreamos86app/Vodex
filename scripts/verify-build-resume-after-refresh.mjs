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

must("src/app/api/projects/[id]/active-build/route.ts", "build_jobs", "active-build API");
must("src/components/create/workspace/immersive-workspace.tsx", "/active-build", "builder resume fetch");
must("src/lib/create/workspace-task-persistence.ts", "persistWorkspaceTask", "session cache");

console.log("\n=== verify:build-resume-after-refresh ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
