#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/components/admin/admin-operations-center-panel.tsx", "admin-operations-center", "ops panel test id");
must("src/app/api/admin/operations-snapshot/route.ts", "previewWorker", "worker health");
must("src/app/api/admin/operations-snapshot/route.ts", "mobileBuilds", "mobile builds");
must("src/app/api/admin/operations-snapshot/route.ts", "zipJobs", "zip jobs");
must("src/app/api/admin/operations-snapshot/route.ts", "storage", "storage errors");
must("src/app/api/admin/operations-snapshot/route.ts", "status", "platform status");
must("src/components/admin/admin-control-center-panel.tsx", "AdminOperationsCenterPanel", "control center tab");

if (errors.length) {
  console.error("verify:admin-operations-center FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:admin-operations-center OK");
