#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

function mustNotExist(rel, label) {
  if (fs.existsSync(path.join(root, rel))) errors.push(`${rel} must not exist — ${label}`);
  else ok.push(`no ${rel}`);
}

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

mustNotExist("middleware.ts", "use src/proxy.ts (Next.js 16 proxy convention)");
mustNotExist("src/middleware.ts", "use src/proxy.ts only");
mustExist("src/proxy.ts");
mustExist("src/app/api/dev/auth-session-check/route.ts");
mustInclude("src/proxy.ts", "createServerClient", "supabase server client in proxy");
mustInclude("src/proxy.ts", "getUser", "proxy session refresh");
mustInclude("src/proxy.ts", "export async function proxy", "proxy entry export");
mustInclude("src/lib/auth/session.ts", "auth session missing", "suppress expected missing session log");

console.log("\n=== verify:auth-session ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
