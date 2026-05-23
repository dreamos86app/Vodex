#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const refFile = path.join(root, "src/lib/supabase/project-ref.ts");
const ref = fs.readFileSync(refFile, "utf8");
if (ref.includes("wciioegiczwqlmlroley") && !ref.includes("xycqut")) {
  ok.push("canonical Supabase project ref");
} else {
  errors.push("project-ref must be wciioegiczwqlmlroley only");
}

const authCallback = path.join(root, "src/app/auth/callback/route.ts");
if (fs.existsSync(authCallback)) ok.push("auth callback route exists");
else errors.push("missing src/app/auth/callback/route.ts");

if (fs.existsSync(path.join(root, "src/middleware.ts"))) {
  errors.push("src/middleware.ts must not exist — use src/proxy.ts");
} else ok.push("no src/middleware.ts");

if (fs.existsSync(path.join(root, "src/proxy.ts"))) ok.push("src/proxy.ts present");

console.log("\n=== verify:auth ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
