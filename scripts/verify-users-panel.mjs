#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dash = fs.readFileSync(path.join(root, "src/components/apps/app-project-dashboard.tsx"), "utf8");

const checks = [
  [!dash.includes('"users"'), "Users tab removed from app dashboard"],
  [dash.includes("Setup"), "Setup tab present"],
  [!dash.includes("Invite"), "No invite UI in app dashboard"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error("✗", label);
    failed = true;
  } else console.log("✓", label);
}
process.exit(failed ? 1 : 0);
