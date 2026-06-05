#!/usr/bin/env node
/** @deprecated P5.4.2 superseded by P5.4.3 — use verify:p543-credit-economy */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

console.warn("⚠ verify:p542-credit-economy is deprecated — running P5.4.3 checks\n");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npm", ["run", "verify:p543-credit-economy"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
