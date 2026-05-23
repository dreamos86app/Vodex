#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

if (fs.existsSync(path.join(root, "src/middleware.ts"))) {
  errors.push("src/middleware.ts must not exist");
} else ok.push("no src/middleware.ts");

const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
if (pkg.includes("NODE_TLS_REJECT_UNAUTHORIZED=0")) {
  errors.push("package.json must not disable TLS");
} else ok.push("no TLS disable in package.json");

function walkDir(rel, cb) {
  const d = path.join(root, rel);
  if (!fs.existsSync(d)) return;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walkDir(path.relative(root, p), cb);
    else if (/\.(ts|tsx|js|mjs|json|md|env\.example)$/.test(ent.name)) cb(p);
  }
}

walkDir("src", (p) => {
  const rel = path.relative(root, p);
  if (rel.replace(/\\/g, "/") === "src/lib/ai/file-fingerprint.ts") return;
  const t = fs.readFileSync(p, "utf8");
  if (t.includes("xycqutvqxtkbszytaxbe")) errors.push(`old xycqut ref in ${rel}`);
});

if (!errors.some((e) => e.includes("xycqut"))) ok.push("no xycqut refs in src/");

function walkClientOnly(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walkClientOnly(p);
    else if (ent.isFile() && /\.(tsx|ts)$/.test(ent.name)) {
      const t = fs.readFileSync(p, "utf8");
      if (!t.includes('"use client"') && !t.includes("'use client'")) continue;
      if (
        /process\.env\.(SUPABASE_SERVICE_ROLE|STRIPE_SECRET)/.test(t) ||
        /createServiceRoleClient\s*\(/.test(t) ||
        /createSupabaseAdmin\s*\(/.test(t)
      ) {
        errors.push(`service role in client: ${path.relative(root, p)}`);
      }
    }
  }
}
if (fs.existsSync(path.join(root, "src/components"))) {
  walkClientOnly(path.join(root, "src/components"));
  ok.push("client bundle service-role scan");
}

const adminMod = path.join(root, "src/lib/supabase/admin.ts");
if (fs.existsSync(adminMod)) {
  const t = fs.readFileSync(adminMod, "utf8");
  if (t.includes("server-only") || t.includes("createServiceRoleClient")) ok.push("admin module server-scoped");
}

const identity = path.join(root, "src/lib/security/client-identity.ts");
if (fs.existsSync(identity) && fs.readFileSync(identity, "utf8").includes("rejectTrustedClientUserId")) {
  ok.push("client user_id rejection helper");
} else errors.push("missing rejectTrustedClientUserId");

console.log("\n=== verify:security ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
