#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npx", ["tsx", path.join(root, "scripts/mid-cycle-upgrade-credits-tests.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error("verify:credit-upgrade-examples FAILED\n", r.stderr || r.stdout);
  process.exit(1);
}
console.log("verify:credit-upgrade-examples OK");
