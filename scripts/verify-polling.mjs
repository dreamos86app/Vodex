#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsView = fs.readFileSync(
  path.join(root, "src/components/apps/projects-view.tsx"),
  "utf8",
);
const dashboard = fs.readFileSync(
  path.join(root, "src/components/create/workspace/app-dashboard-panel.tsx"),
  "utf8",
);

const checks = [
  [!projectsView.includes('fetch("/api/projects?reconcile=1")'), "projects list avoids unconditional reconcile=1"],
  [projectsView.includes("lastLoadRef"), "projects list debounces reload"],
  [dashboard.includes("readinessFetchedRef"), "dashboard dedupes publish/readiness fetch"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error("✗", label);
    failed = true;
  } else {
    console.log("✓", label);
  }
}
process.exit(failed ? 1 : 0);
