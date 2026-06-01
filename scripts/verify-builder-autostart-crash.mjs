#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const pkg = read("package.json");

const immersive = read("src/components/create/workspace/immersive-workspace.tsx");
const builder = read("src/app/(workspace)/apps/[appId]/builder/page.tsx");
const gate = read("src/components/create/builder-project-gate.tsx");

const checks = [
  ["builder validates conversationId UUID", () => {
    if (!builder.includes("isUuid")) throw new Error("builder page must validate UUID");
    if (!gate.includes("isUuid")) throw new Error("gate must validate UUID");
  }],
  ["autostart safe submit ref", () => {
    if (!immersive.includes("invokeAutostartSubmit")) throw new Error("invokeAutostartSubmit");
    if (!immersive.includes("submit_not_ready")) throw new Error("submit_not_ready guard");
  }],
  ["autostart try/catch", () => {
    if (!immersive.includes("autostart_effect_throw")) throw new Error("autostart try/catch");
  }],
  ["provisional display name in builder", () => {
    if (!builder.includes("resolveProjectDisplayName")) throw new Error("display name");
  }],
  ["catalog sync on project refresh", () => {
    if (!immersive.includes("notifyProjectCatalogUpdated")) throw new Error("catalog sync");
  }],
  ["npm script", () => {
    if (!pkg.includes('"verify:builder-autostart-crash"')) throw new Error("npm script");
  }],
];

let failed = 0;
for (const [label, fn] of checks) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}:`, e instanceof Error ? e.message : e);
  }
}
process.exit(failed ? 1 : 0);
