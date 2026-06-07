#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const immersive = fs.readFileSync(
  path.join(root, "src/components/create/workspace/immersive-workspace.tsx"),
  "utf8",
);

const checks = [
  ["!effectiveProjectId", /showPlanInChat[\s\S]*!effectiveProjectId/],
  ["planFirst requires no project", /planFirstEnabled[\s\S]*!effectiveProjectId/],
  ["task router repair", /routeBuilderTask/],
  ["repair route uses edit", /project_repair/],
];

for (const [label, re] of checks) {
  if (!re.test(immersive)) {
    console.error(`✗ verify:repair-flow-no-blueprint missing: ${label}`);
    process.exit(1);
  }
}
console.log("✓ verify:repair-flow-no-blueprint passed");
