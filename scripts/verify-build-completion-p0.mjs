#!/usr/bin/env node
/**
 * P0 build completion guards — static checks for preview/credits/workflow contracts.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
    return false;
  }
  console.log("OK:", msg);
  return true;
}

const checks = [
  () => {
    const w = read("src/lib/build/workflow-status-guards.ts");
    assert(!w.includes("UI quality needs a repair pass"), "no UI quality repair copy in workflow guards");
    assert(w.includes("Build needs attention"), "technical repair headline present");
    assert(w.includes("First version ready"), "completed headline present");
  },
  () => {
    const p = read("src/lib/build/post-build-contract.ts");
    assert(!p.includes("UI quality needs a repair pass"), "no UI quality repair userMessage");
    assert(p.includes("canCompleteWithSavedFiles"), "saved-files completion helper used");
  },
  () => {
    const e = read("src/lib/build/execute-staged-build-job.ts");
    assert(e.includes("postBuildFailures"), "merged post-build failures in staged job");
    assert(!e.includes('type: "refunded"') || e.split('type: "refunded"').length <= 2, "no refund after saved-files technical block");
  },
  () => {
    const pv = read("src/lib/preview/preview-build-service.ts");
    assert(pv.includes("UI polish warning"), "preview proceeds with internal polish warning");
    assert(!pv.includes("UI quality gate failed (score"), "no score in preview failure");
  },
  () => {
    const a = read("src/lib/build/app-archetype-classifier.ts");
    assert(a.includes("subscription_box_manager"), "subscription_box_manager archetype");
  },
  () => {
    const s = read("src/lib/build/subscription-box-scaffold.ts");
    assert(s.includes("app/subscribers/page.tsx"), "subscription box subscribers route");
    assert(s.includes("app/shipments/page.tsx"), "subscription box shipments route");
  },
  () => {
    const admin = read("src/components/admin/admin-users-panel.tsx");
    assert(admin.includes("monthly_token_limit + Math.max(u.bonus_credits"), "admin build credits include bonus in cap");
  },
  () => {
    const home = read("src/components/os-home/os-home.tsx");
    assert(!home.includes("} finally {\n      setCreating(false)"), "home keeps loading until navigation on success");
  },
  () => {
    const br = read("src/components/create/workspace/build-run-summary.tsx");
    assert(br.includes("insufficient_credits_before_start"), "Add credits only on insufficient credits");
  },
];

let failed = 0;
for (const c of checks) {
  try {
    c();
  } catch (err) {
    console.error("FAIL:", err.message);
    failed++;
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`\nAll ${checks.length} P0 build completion checks passed.`);
} else {
  console.error(`\n${failed || "Some"} check(s) failed.`);
  process.exit(1);
}
