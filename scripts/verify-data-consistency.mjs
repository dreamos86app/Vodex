#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/lib/stores/credits-store.ts", "syncFromDB", "credits sync");
mustInclude("src/components/chat/chat-view.tsx", "reloadConversations", "chat list reload");
mustInclude("src/components/dev/admin-diagnostics-drawer.tsx", "infraBlockers", "infra-only blockers");
mustInclude("src/lib/import/zip-file-validator.ts", "MAX_FILES: 1500", "zip file limit 1500");
mustInclude("src/lib/import/zip-import-service.ts", "scanProviderCostUsd: 0", "deterministic zip scan");
mustInclude("src/lib/import/zip-storage.ts", "zip-imports", "zip-imports bucket constant");
mustInclude("src/lib/projects/app-file-rows.ts", "mime_type", "app_files mime_type in row builder");

console.log("\n=== verify:data-consistency ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
