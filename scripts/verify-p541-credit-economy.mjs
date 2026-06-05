#!/usr/bin/env node
/** @deprecated P5.4.1 superseded by P5.4.3 — use verify:p543-credit-economy */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.warn("⚠ verify:p541-credit-economy is deprecated — running P5.4.3 checks\n");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npm", ["run", "verify:p543-credit-economy"], { cwd: root, shell: true, encoding: "utf8" });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
