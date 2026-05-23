#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npm run verify:credit-economy-db", { cwd: root, shell: true, stdio: "inherit" });
process.exit(r.status ?? 1);
