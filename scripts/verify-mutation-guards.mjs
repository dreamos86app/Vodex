#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

/** Expensive mutation routes — must use guardExpensiveRoute or requireDreamosOwner. */
const MUTATION_ROUTES = [
  { rel: "src/app/api/chat/route.ts", expensive: true },
  { rel: "src/app/api/build/blueprint/route.ts", expensive: true, methods: ["POST", "PUT"] },
  { rel: "src/app/api/build/polish/route.ts", expensive: true },
  { rel: "src/app/api/projects/create-from-prompt/route.ts", expensive: true, skipOwner: true },
  { rel: "src/app/api/projects/[id]/publish/route.ts", expensive: true, methods: ["POST"] },
  { rel: "src/app/api/projects/[id]/unpublish/route.ts", expensive: true },
  { rel: "src/app/api/projects/[id]/preview/start/route.ts", expensive: true },
  { rel: "src/app/api/projects/[id]/repair/route.ts", expensive: true, methods: ["POST"] },
  { rel: "src/app/api/projects/[id]/status/route.ts", expensive: false, methods: ["PATCH"] },
  { rel: "src/app/api/editor/apply-diff/route.ts", expensive: true },
  { rel: "src/app/api/editor/pending-diff/route.ts", expensive: true, methods: ["POST", "PUT"] },
  { rel: "src/app/api/editor/checkpoints/route.ts", expensive: true, methods: ["POST"] },
  { rel: "src/app/api/deploy/vercel/start/route.ts", expensive: true },
  { rel: "src/app/api/deploy/export/route.ts", expensive: true },
  { rel: "src/app/api/credits/quote/route.ts", expensive: true },
  { rel: "src/app/api/admin/credits/route.ts", expensive: false, admin: true },
];

function hasStrongGuard(text) {
  return (
    text.includes("guardExpensiveRoute") ||
    text.includes("requireDreamosOwner") ||
    (text.includes("requireAuthUser") &&
      (text.includes("requireMutationProjectId") || text.includes("requireOwnedProject")))
  );
}

function hasOwnerCheck(text) {
  return (
    text.includes("requireOwnedProject") ||
    text.includes('.eq("owner_id"') ||
    text.includes(".eq('owner_id'")
  );
}

function rejectsClientUserId(text) {
  return text.includes("guardExpensiveRoute") || text.includes("rejectTrustedClientUserId");
}

for (const route of MUTATION_ROUTES) {
  const full = path.join(root, route.rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${route.rel}`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");

  if (route.admin) {
    if (text.includes("requireDreamosOwner")) ok.push(`${route.rel} admin owner gate`);
    else errors.push(`${route.rel} missing requireDreamosOwner`);
    continue;
  }

  if (!hasStrongGuard(text)) {
    errors.push(`${route.rel} missing guardExpensiveRoute or auth+project guard`);
    continue;
  }

  if (route.expensive && !text.includes("guardExpensiveRoute")) {
    errors.push(`${route.rel} expensive route must use guardExpensiveRoute`);
    continue;
  }

  if (!route.admin && route.rel.includes("projects/") && !route.skipOwner && !hasOwnerCheck(text)) {
    errors.push(`${route.rel} missing owner check`);
    continue;
  }

  if (route.expensive && !rejectsClientUserId(text)) {
    errors.push(`${route.rel} must reject client-provided user_id`);
    continue;
  }

  ok.push(`${route.rel} guarded`);
}

const guardLib = path.join(root, "src/lib/ids/api-mutation-guard.ts");
if (fs.existsSync(guardLib)) ok.push("api-mutation-guard.ts exists");
else errors.push("missing api-mutation-guard.ts");

console.log("\n=== verify:mutation-guards ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
