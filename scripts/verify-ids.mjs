#!/usr/bin/env node
/**
 * Proves mutation routes validate IDs — no client user_id trust, projectId required where scoped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const ids = fs.readFileSync(path.join(root, "src/lib/ids/required-ids.ts"), "utf8");
if (ids.includes("requireProjectId")) ok.push("requireProjectId");
else errors.push("missing requireProjectId");
if (ids.includes("USER_FACING_ID_ERRORS")) ok.push("user-facing errors");

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function hasIdGuard(text) {
  return (
    text.includes("requireProjectId") ||
    text.includes("requireMutationProjectId") ||
    text.includes("requireAuthUser") ||
    text.includes("jsonMissingId")
  );
}

function hasStrongMutationGuard(text) {
  return (
    text.includes("guardExpensiveRoute") &&
    (text.includes("requireMutationProjectId") ||
      text.includes("requireProjectId") ||
      text.includes("requireOwnedProject"))
  );
}

function hasOwnerGuard(text) {
  return text.includes("requireOwnedProject") || text.includes('.eq("owner_id"');
}

function rejectsClientUserId(text) {
  return text.includes("guardExpensiveRoute") || text.includes("rejectTrustedClientUserId");
}

/** Auth-only mutation routes (no projectId required) */
const AUTH_ONLY_ROUTES = [
  "src/app/api/chat/route.ts",
  "src/app/api/credits/quote/route.ts",
];

for (const route of AUTH_ONLY_ROUTES) {
  const c = read(route);
  if (!c) {
    errors.push(`missing ${route}`);
    continue;
  }
  if (!c.includes("guardExpensiveRoute")) {
    errors.push(`${route} missing guardExpensiveRoute`);
    continue;
  }
  if (!rejectsClientUserId(c)) {
    errors.push(`${route} must reject client-provided user_id`);
    continue;
  }
  if (route.includes("chat") && !c.includes('.eq("owner_id"')) {
    errors.push(`${route} must verify owner when projectId present`);
    continue;
  }
  ok.push(`${route} auth + identity guarded`);
}

/** Body-scoped projectId routes */
const BODY_PROJECT_ROUTES = [
  "src/app/api/projects/create-from-prompt/route.ts",
  "src/app/api/build/polish/route.ts",
  "src/app/api/deploy/vercel/start/route.ts",
  "src/app/api/deploy/export/route.ts",
  "src/app/api/editor/apply-diff/route.ts",
  "src/app/api/editor/pending-diff/route.ts",
  "src/app/api/editor/checkpoints/route.ts",
  "src/app/api/build/blueprint/route.ts",
];

/** Param-scoped [id] routes */
const PARAM_PROJECT_ROUTES = [
  "src/app/api/projects/[id]/summary/route.ts",
  "src/app/api/projects/[id]/status/route.ts",
  "src/app/api/projects/[id]/publish/route.ts",
  "src/app/api/projects/[id]/unpublish/route.ts",
  "src/app/api/projects/[id]/preview/start/route.ts",
  "src/app/api/projects/[id]/repair/route.ts",
];

for (const route of BODY_PROJECT_ROUTES) {
  const c = read(route);
  if (!c) {
    errors.push(`missing ${route}`);
    continue;
  }
  if (!hasStrongMutationGuard(c)) {
    errors.push(`${route} missing guardExpensiveRoute + project id guard`);
    continue;
  }
  if (!hasOwnerGuard(c) && route.includes("projects/") === false && route !== "src/app/api/projects/create-from-prompt/route.ts") {
    if (!route.includes("chat") && !route.includes("credits/quote") && !route.includes("blueprint")) {
      if (!hasOwnerGuard(c)) {
        errors.push(`${route} missing owner check`);
        continue;
      }
    }
  }
  if (!rejectsClientUserId(c)) {
    errors.push(`${route} must reject client-provided user_id`);
    continue;
  }
  ok.push(`${route} validates ids + guards`);
}

for (const route of PARAM_PROJECT_ROUTES) {
  const c = read(route);
  if (!c) {
    errors.push(`missing ${route}`);
    continue;
  }
  if (!hasIdGuard(c)) {
    errors.push(`${route} missing id validation`);
    continue;
  }
  if (!hasOwnerGuard(c)) {
    errors.push(`${route} missing owner check`);
    continue;
  }
  ok.push(`${route} validates ids`);
}

const deployStart = read("src/app/api/deploy/vercel/start/route.ts");
if (deployStart) {
  if (deployStart.includes("requireMutationProjectId") && deployStart.includes("guardExpensiveRoute")) {
    ok.push("deploy/vercel/start guarded");
  } else {
    errors.push("deploy/vercel/start missing required guards");
  }
  if (deployStart.includes("requireOwnedProject")) ok.push("deploy/vercel/start ownership check");
  else errors.push("deploy/vercel/start missing ownership check");
  if (!deployStart.includes("user_id: authUser") && !deployStart.includes("user_id: user.id")) {
    ok.push("deploy/vercel/start uses session user_id only");
  }
}

const guardLib = read("src/lib/ids/api-mutation-guard.ts");
if (guardLib?.includes("rejectTrustedClientUserId") || read("src/lib/security/route-guard.ts")?.includes("rejectTrustedClientUserId")) {
  ok.push("client user_id rejection wired");
}

console.log("\n=== verify:ids ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
