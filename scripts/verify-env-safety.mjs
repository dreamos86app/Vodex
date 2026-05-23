#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function fail(msg) {
  errors.push(msg);
}
function pass(msg) {
  ok.push(msg);
}

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };

if (env.NEXT_PUBLIC_SUPABASE_URL?.includes("wciioegiczwqlmlroley")) {
  pass("NEXT_PUBLIC_SUPABASE_URL uses canonical ref");
} else {
  fail("NEXT_PUBLIC_SUPABASE_URL must include wciioegiczwqlmlroley");
}

const tlsOff = env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
if (env.NODE_ENV === "production" && tlsOff) {
  fail("NODE_TLS_REJECT_UNAUTHORIZED=0 must not be set in production");
} else if (tlsOff) {
  pass(
    "warn: NODE_TLS_REJECT_UNAUTHORIZED=0 — remove from Windows: System Properties → Environment Variables → delete from User and System",
  );
} else {
  pass("TLS verification not disabled in env or process");
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = JSON.stringify(pkg.scripts ?? {});
if (scripts.includes("NODE_TLS_REJECT_UNAUTHORIZED")) {
  fail("package.json scripts must not set NODE_TLS_REJECT_UNAUTHORIZED");
} else {
  pass("package.json scripts do not disable TLS");
}

if (fs.existsSync(path.join(root, "src/middleware.ts"))) {
  fail("src/middleware.ts must not exist — use src/proxy.ts");
} else {
  pass("no src/middleware.ts");
}

if (fs.existsSync(path.join(root, "src/proxy.ts"))) {
  pass("src/proxy.ts present");
}

const pub = env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
if (pub) fail("service role must not be in NEXT_PUBLIC_* env");

function scanDir(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scanDir(full, depth + 1);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
      const rel = path.relative(root, full);
      if (rel.includes("file-fingerprint") || rel.includes("project-ref")) continue;
      const text = fs.readFileSync(full, "utf8");
      if (text.includes("xycqutvqxtkbszytaxbe")) {
        fail(`old xycqut ref in ${rel}`);
      }
    }
  }
}
scanDir(path.join(root, "src"));
if (!errors.some((e) => e.includes("xycqut"))) pass("no xycqut refs in src/");

console.log("\n=== verify:env-safety ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
