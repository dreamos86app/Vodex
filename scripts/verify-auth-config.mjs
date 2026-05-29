#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else errors.push(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
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

function refFromJwt(jwt) {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

const suite = process.argv[2] ?? "all";
const env = { ...process.env, ...loadEnvLocal() };
const canonical = "wciioegiczwqlmlroley";
const config = read("src/lib/supabase/supabase-project-config.ts");
const consistency = read("src/lib/supabase/supabase-project-consistency.ts");
const authConfigRoute = read("src/app/api/dev/auth-config/route.ts");
const authConfigSnapshot = read("src/lib/supabase/auth-config-snapshot.ts");
const oauthRedirect = read("src/lib/auth/oauth-redirect.ts");

function runAll() {
  assert(config.includes(`PRODUCTION_CANONICAL_PROJECT_REF`), "canonical ref defined");
  assert(config.includes("xycqutvqxtkbszytaxbe"), "legacy ref listed as allowed");
  assert(consistency.includes("validateSupabaseProjectConsistency"), "consistency validator");
  assert(authConfigRoute.includes("buildAuthConfigSnapshot"), "auth-config route");
  assert(!authConfigRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "route does not return service key");
  assert(authConfigSnapshot.includes("expectedGoogleRedirectUri"), "snapshot includes Google URI");

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
  const anonRef = refFromJwt(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRef = refFromJwt(env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY);

  assert(urlRef === canonical, ".env.local URL uses canonical ref");
  assert(anonRef === canonical, ".env.local anon JWT ref matches canonical");
  assert(!serviceRef || serviceRef === canonical, ".env.local service role ref matches URL");

  assert(
    oauthRedirect.includes("assertCanonicalOAuthRedirectTo") &&
      oauthRedirect.includes("must not include query"),
    "canonical OAuth redirect rejects query/hash",
  );
}

const suites = {
  "single-supabase-project": () => {
    assert(consistency.includes("anonKeyProjectRef !== urlProjectRef"), "detects anon/url mismatch");
  },
  "google-redirect-uri-matches-supabase-project": () => {
    assert(config.includes("expectedGoogleOAuthRedirectUri"), "expectedGoogleOAuthRedirectUri helper");
  },
  "no-mixed-supabase-project-refs": () => {
    const urlRef = refFromJwt(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const urlHostRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase/)?.[1];
    assert(urlRef === urlHostRef, "local env has no mixed refs");
  },
  "diagnostic-no-secrets": () => {
    assert(!authConfigSnapshot.includes("eyJ"), "snapshot source has no JWT samples");
    assert(authConfigRoute.includes("requireDreamosOwner"), "production gated");
  },
  "referral-oauth-still-canonical": () => {
    assert(oauthRedirect.includes("OAUTH_CALLBACK_DENY_PARAMS"), "referral params denied on callback");
  },
};

if (suite === "all") runAll();
else if (suites[suite]) suites[suite]();
else errors.push(`unknown suite: ${suite}`);

console.log(`\n=== verify:auth-config (${suite}) ===\n`);
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
