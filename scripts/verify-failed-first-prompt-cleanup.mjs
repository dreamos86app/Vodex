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

must("src/lib/projects/create-project-from-prompt.ts", "draft_pending", "provisional draft on create");
must("src/lib/projects/create-project-from-prompt.ts", "hide_from_home_main", "hide from main until ready");
must("src/lib/projects/user-visible-projects.ts", "isFailedAttemptProject", "failed attempt filter");
must("src/app/api/projects/[id]/archive-failed-attempt/route.ts", "failed_attempt", "archive endpoint");

const visible = fs.readFileSync(path.join(root, "src/lib/projects/user-visible-projects.ts"), "utf8");
if (visible.includes('create_flow_state === "project_ready"') && visible.includes("return true")) {
  errors.push("user-visible-projects still auto-shows project_ready shells");
} else {
  ok.push("no auto-show project_ready in main list");
}

console.log("\n=== verify:failed-first-prompt-cleanup ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
