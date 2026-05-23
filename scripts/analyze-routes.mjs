#!/usr/bin/env node
/**
 * Lists key app routes and whether loading.tsx / prefetch hooks exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROUTES = [
  { path: "/create", page: "src/app/(workspace)/create/page.tsx", loading: "src/app/(workspace)/create/loading.tsx" },
  { path: "/dashboard", page: "src/app/(app)/dashboard/page.tsx", loading: "src/app/(app)/dashboard/loading.tsx" },
  { path: "/chat", page: "src/app/(app)/chat/page.tsx", loading: "src/app/(app)/chat/loading.tsx" },
  { path: "/", page: "src/app/(app)/page.tsx", loading: "src/app/(app)/loading.tsx" },
  { path: "/pricing", page: "src/app/(app)/pricing/page.tsx", loading: null },
  { path: "/billing", page: "src/app/(app)/billing/page.tsx", loading: null },
];

console.log("\n=== analyze:routes ===\n");
for (const r of ROUTES) {
  const pageOk = fs.existsSync(path.join(root, r.page));
  const loadingOk = r.loading ? fs.existsSync(path.join(root, r.loading)) : false;
  console.log(
    `${r.path.padEnd(14)} page=${pageOk ? "yes" : "NO"} loading=${loadingOk ? "yes" : r.loading ? "no" : "n/a"}`,
  );
}
console.log("\nNav instrumentation: src/lib/navigation/route-perf.ts\n");
