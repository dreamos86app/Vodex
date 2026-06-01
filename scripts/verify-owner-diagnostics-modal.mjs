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

must("src/components/create/workspace/build-diagnostics-center.tsx", "build-diagnostics-modal", "center modal");
must("src/components/create/workspace/build-diagnostics-center.tsx", "items-center justify-center", "centered layout");
must("src/components/create/workspace/build-diagnostics-center.tsx", "isDreamosOwnerEmail", "owner gate");
must("src/components/create/workspace/admin-diagnostics-fab.tsx", "admin-diagnostics-reopen", "reopen FAB after close");

console.log("\n=== verify:owner-diagnostics-modal ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
