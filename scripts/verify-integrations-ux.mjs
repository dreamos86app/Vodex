#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const panel = fs.readFileSync(path.join(root, "src/components/integrations/project-integrations-panel.tsx"), "utf8");

const checks = [
  [panel.includes("your app"), "Supabase scoped to user app"],
  [panel.includes("Export source"), "GitHub export fallback"],
  [!panel.includes("GITHUB_CLIENT_SECRET") || panel.includes("Advanced"), "No scary GitHub env in main UI"],
  [panel.includes("Manual connection"), "Supabase manual connection label"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error("✗", label);
    failed = true;
  } else console.log("✓", label);
}
process.exit(failed ? 1 : 0);
