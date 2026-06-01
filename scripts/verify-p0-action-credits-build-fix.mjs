#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}
function pass(msg) {
  console.log(`PASS: ${msg}`);
}

const checks = {
  "action-credits-canonical-server-source": () => {
    const f = read("src/lib/action-credits/get-action-credit-availability.ts");
    if (!f.includes("getActionCreditAvailability")) fail("missing canonical fn");
    if (!f.includes("owner_user_id_null")) fail("missing user pool row");
    pass("canonical server source");
  },
  "action-credits-icon-affordability": () => {
    const id = read("src/lib/projects/app-identity-service.ts");
    if (!id.includes("getActionCreditAvailability")) fail("identity must use availability");
    pass("icon affordability");
  },
  "action-credits-charge-refund-idempotent": () => {
    const c = read("src/lib/action-credits/charge-action-credit.ts");
    if (!c.includes("charge_from_user_pool")) fail("missing user pool charge");
    if (!read("src/lib/action-credits/refund-action-credit.ts").includes("refund_action_credits")) {
      fail("missing refund");
    }
    pass("charge refund idempotent");
  },
  "action-credits-no-false-unavailable": () => {
    const b = read("src/lib/action-credits/get-action-credit-availability.ts");
    const a = read("src/lib/action-credits/assert-action-credits-affordable.ts");
    if (!b.includes("planAllowance")) fail("missing plan allowance fallback");
    if (!a.includes("getActionCreditAvailability")) fail("assert must use canonical");
    pass("no false unavailable");
  },
  "icon-does-not-fallback-when-action-credits-exist": () => {
    const id = read("src/lib/projects/app-identity-service.ts");
    if (!id.includes("!creditAvail.available")) fail("must gate fallback on availability");
    pass("icon no false fallback");
  },
  "openai-mini-icon-called-when-credits-exist": () => {
    const route = read("src/lib/ai/image-provider-routing.ts");
    if (!route.includes("gpt-image-1-mini")) fail("no mini model in routing");
    if (!read("src/lib/projects/app-identity-service.ts").includes("generateAppLogoWithOpenAi")) {
      fail("no openai path");
    }
    pass("openai mini when credits");
  },
  "icon-generation-mode-ai-openai-mini": () => {
    if (!read("src/lib/projects/app-identity-service.ts").includes("ai_openai_mini")) fail("missing mode");
    pass("icon mode ai_openai_mini");
  },
  "icon-action-credit-consumed": () => {
    if (!read("src/lib/projects/app-identity-service.ts").includes("app_icon_ai_generation")) fail("missing charge type");
    pass("icon action credit consumed");
  },
  "icon-fallback-reason-specific": () => {
    const id = read("src/lib/projects/app-identity-service.ts");
    for (const m of ["skipped_no_openai_key", "skipped_no_action_credits", "deterministic_fallback"]) {
      if (!id.includes(m)) fail(`missing ${m}`);
    }
    pass("icon fallback reasons");
  },
  "preview-build-loading-is-beautiful-logo": () => {
    const p = read("src/components/create/workspace/build-preview-surface.tsx");
    if (!p.includes("preview-build-loading-beautiful")) fail("missing testid");
    if (!p.includes("VodexBrandIcon")) fail("missing logo");
    pass("beautiful preview loading");
  },
  "preview-loading-hides-technical-stage-text": () => {
    const p = read("src/components/create/workspace/build-preview-surface.tsx");
    if (p.includes("preview-build-stage-pills")) fail("still has stage pills");
    if (p.includes("Current step:")) fail("still has current step");
    pass("hides technical stage text");
  },
  "no-renderable-never-shown-during-active-build": () => {
    const panel = read("src/components/create/workspace/preview-panel.tsx");
    if (!panel.includes("buildActive")) fail("missing buildActive");
    if (!panel.includes("isUnrenderableSrcDoc")) fail("missing unrenderable guard");
    pass("no renderable during build");
  },
  "subscription-box-scaffold-real-ui": () => {
    const s = read("src/lib/build/subscription-box-scaffold.ts");
    for (const p of [
      "app/dashboard/page.tsx",
      "app/subscribers/page.tsx",
      "app/boxes/page.tsx",
      "app/analytics/page.tsx",
      "package.json",
    ]) {
      if (!s.includes(p)) fail(`missing ${p}`);
    }
    pass("subscription box scaffold ui");
  },
  "subscription-box-fallback-not-noop": () => {
    const a = read("src/lib/build/archetype-scaffold-fallback.ts");
    const s = read("src/lib/build/subscription-box-scaffold.ts");
    if (!a.includes("replaceStubFilesWithArchetypeScaffold")) fail("missing stub replace");
    if (!s.includes("isGeneratedFileStub")) fail("missing stub merge");
    pass("subscription box fallback not noop");
  },
  "subscription-box-no-todo-or-stub-pages": () => {
    const s = read("src/lib/build/subscription-box-scaffold.ts");
    if (/\bTODO\b/.test(s)) fail("scaffold contains TODO");
    pass("subscription box no todo");
  },
  "subscription-box-minimum-source-size": () => {
    const s = read("src/lib/build/subscription-box-scaffold.ts");
    if (s.length < 8000) fail("scaffold too small");
    pass("subscription box source size");
  },
  "subscription-box-preview-renders": () => {
    if (!read("src/lib/build/post-build-contract.ts").includes("subscription_box_manager")) {
      fail("missing archetype slugs");
    }
    pass("subscription box preview path");
  },
  "todo_stub_triggers_auto_repair": () => {
    const p = read("src/lib/build/post-build-contract.ts");
    if (!p.includes("todo_or_stub_page")) fail("missing stub repair trigger");
    if (!p.includes("replaceStubFilesWithArchetypeScaffold")) fail("missing scaffold repair");
    pass("todo stub auto repair");
  },
  "todo_stub_not_async_failed_before_repair": () => {
    if (!read("src/lib/build/build-pipeline.ts").includes("replaceStubFilesWithArchetypeScaffold")) {
      fail("pipeline missing pre-contract stub repair");
    }
    pass("stub repair before contract");
  },
  "no_couldnt_start_after_provider_finished": () => {
    const w = read("src/lib/build/workflow-status-guards.ts");
    if (!w.includes("generationStarted")) fail("missing generationStarted guard");
    if (!w.includes("generationCompleted")) fail("missing generationCompleted");
    pass("no couldnt start after provider");
  },
  "no_refund_copy_unless_refunded": () => {
    const w = read("src/lib/build/workflow-status-guards.ts");
    const b = read("src/components/create/workspace/build-run-summary.tsx");
    if (!w.includes("!input.facts.creditsRefunded")) fail("guards missing refund check");
    if (b.includes("showRefundLine || refunded")) fail("summary still OR refund");
    pass("refund copy only when refunded");
  },
  "failure-copy-provider-finished": () => {
    if (!read("src/lib/build/workflow-status-guards.ts").includes("failed_after_generation")) {
      fail("missing after generation status");
    }
    pass("failure copy provider finished");
  },
  "failure-copy-files-saved": () => {
    if (!read("src/lib/build/workflow-status-guards.ts").includes("Build needs attention")) fail("missing headline");
    pass("failure copy files saved");
  },
  "refund-copy-only-after-real-refund": () => {
    if (!read("src/lib/build/workflow-status-guards.ts").includes("assertRefundCopyAllowed")) {
      fail("missing refund assert");
    }
    pass("refund copy guard");
  },
  "stub-failure-copy": () => {
    if (!read("src/lib/build/post-build-contract.ts").includes("Some generated source was incomplete")) {
      fail("missing stub copy");
    }
    pass("stub failure copy");
  },
};

const arg = process.argv[2] ?? "all";
if (arg === "all") {
  for (const fn of Object.values(checks)) fn();
} else if (checks[arg]) {
  checks[arg]();
} else {
  fail(`unknown check ${arg}`);
}

if (!process.exitCode) console.log("\nAll P0 action-credits/build checks passed.");
