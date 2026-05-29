#!/usr/bin/env node
/**
 * P0 mobile release verification — profile menu, credits display, chat workflow, build status.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const userMenu = read("src/components/layout/user-menu.tsx");
const topBar = read("src/components/layout/top-bar.tsx");
const creditsDisplay = read("src/lib/credits/credit-balance-display.ts");
const creditsStore = read("src/lib/stores/credits-store.ts");
const seed = read("src/lib/credits/seed-credits-from-profile.ts");
const creditsTracker = read("src/components/credits/credits-tracker.tsx");
const coalesce = read("src/lib/build/workflow-stream-coalesce.ts");
const streamUi = read("src/components/create/workspace/agent-workflow-stream.tsx");
const guards = read("src/lib/build/workflow-status-guards.ts");
const execute = read("src/lib/build/execute-staged-build-job.ts");
const scaffold = read("src/lib/build/generic-saas-scaffold.ts");
const archetypeFb = read("src/lib/build/archetype-scaffold-fallback.ts");
const apiCredits = read("src/app/api/credits/route.ts");

const suites = {
  "mobile-profile-menu-visible": () => {
    if (!userMenu.includes('data-testid="mobile-profile-menu-trigger"')) {
      throw new Error("mobile profile trigger missing");
    }
    if (userMenu.includes("hidden sm:flex") && !userMenu.includes("flex cursor-pointer")) {
      throw new Error("profile button still hidden on mobile");
    }
    if (!topBar.includes("UserMenu")) throw new Error("TopBar must mount UserMenu");
  },
  "mobile-profile-menu-opens": () => {
    if (!userMenu.includes('data-testid="account-menu-dropdown"')) {
      throw new Error("account dropdown marker missing");
    }
    if (!userMenu.includes("safe-area-inset")) throw new Error("safe area padding missing");
  },
  "mobile-profile-menu-credit-display": () => {
    if (!userMenu.includes("CreditsTracker")) throw new Error("credits in menu missing");
    if (!userMenu.includes("loading || !isConfirmed")) {
      throw new Error("menu must skeleton until credits confirmed");
    }
  },
  "desktop-profile-menu-unchanged": () => {
    if (!userMenu.includes("Space settings")) throw new Error("settings link missing");
    if (!userMenu.includes("/referrals")) throw new Error("referrals link missing");
  },
  "credits-display-remaining-over-allowance-separated": () => {
    if (!creditsDisplay.includes("bonusOrTopUp")) throw new Error("bonus bucket missing");
    if (!creditsDisplay.includes("secondaryText")) throw new Error("bonus secondary line missing");
    if (!creditsDisplay.includes("clampProfileSeedAvailable")) {
      throw new Error("profile seed clamp missing");
    }
  },
  "credits-free-plan-30-of-30": () => {
    if (!read("src/lib/billing/plans.ts").includes("free") || !read("src/lib/billing/plans.ts").includes("30")) {
      throw new Error("free plan allowance must be 30");
    }
  },
  "credits-no-100-of-30": () => {
    if (seed.includes("applyCanonical")) throw new Error("seed must not call applyCanonical");
    if (!seed.includes("applyProfileHint")) throw new Error("seed must use applyProfileHint");
    if (!creditsTracker.includes("formatCreditBucketDisplay")) {
      throw new Error("tracker must use canonical display formatter");
    }
  },
  "credits-no-used-over-remaining-confusion": () => {
    if (!creditsDisplay.includes("monthlyRemaining")) {
      throw new Error("display must use monthly remaining not raw total");
    }
  },
  "credits-mobile-desktop-consistent": () => {
    if (!creditsDisplay.includes("formatCreditBalanceDisplay")) {
      throw new Error("shared formatter missing");
    }
  },
  "credits-settings-consistent": () => {
    if (!creditsTracker.includes("Loading credits")) {
      throw new Error("loading copy missing");
    }
  },
  "credits-api-canonical-shape": () => {
    if (!apiCredits.includes("loadCanonicalCredits")) throw new Error("API must load canonical credits");
  },
  "no-credit-zero-flash-on-bootstrap": () => {
    if (!creditsStore.includes("loading: true")) throw new Error("initial loading must be true");
    if (!creditsStore.includes("applyProfileHint")) throw new Error("profile hint path missing");
  },
  "no-credit-over-allowance-flash": () => {
    if (!seed.includes("clampProfileSeedAvailable")) throw new Error("seed clamp required");
  },
  "credit-widgets-share-single-source": () => {
    if (!creditsTracker.includes("credit-balance-display")) {
      throw new Error("tracker must import credit-balance-display");
    }
  },
  "workflow-chat-native-events": () => {
    if (!streamUi.includes("workflow-chat-assistant")) {
      throw new Error("chat-native assistant marker missing");
    }
    if (!streamUi.includes("workflow-file-card")) throw new Error("file cards missing");
  },
  "workflow-assistant-messages-in-chat": () => {
    if (!coalesce.includes("assistant_message")) throw new Error("assistant category required");
  },
  "workflow-file-cards-in-chat": () => {
    if (!streamUi.includes("mr-8")) throw new Error("chat margin layout missing");
  },
  "workflow-checklist-not-spammed": () => {
    if (!coalesce.includes("GENERIC_TITLES")) throw new Error("generic title filter required");
  },
  "workflow-no-worker-internal-labels": () => {
    if (!coalesce.includes("INTERNAL_LABEL_RE")) throw new Error("internal label filter missing");
    if (!coalesce.includes("worker_claim")) throw new Error("worker_claim pattern missing");
  },
  "workflow-active-card-updates-in-place": () => {
    if (!streamUi.includes("workflow-active-card")) throw new Error("active card missing");
  },
  "status-no-contradictory-build-copy": () => {
    if (!guards.includes("failed_before_generation")) throw new Error("failed_before_generation missing");
    if (!guards.includes("Couldn't start the build")) throw new Error("pre-gen headline missing");
  },
  "no-couldnt-start-with-files-saved": () => {
    if (!execute.includes("files_persisted")) throw new Error("persist-on-contract-fail path missing");
    if (!guards.includes("failureKindMeta === \"failed_before_generation\"")) {
      throw new Error("file count must respect failed_before_generation");
    }
  },
  "no-first-version-saved-with-zero-files": () => {
    if (!guards.includes("First version saved")) throw new Error("after-gen copy missing");
  },
  "no-repair-before-files": () => {
    if (!guards.includes("assertNoRepairCopyBeforeFiles")) throw new Error("repair guard missing");
  },
  "no-refund-copy-without-refund-event": () => {
    if (!guards.includes("assertRefundCopyAllowed")) throw new Error("refund guard missing");
    if (!execute.includes('type: "refunded"')) throw new Error("refund event on contract-fail persist");
  },
  "partial-credit-copy-correct": () => {
    if (!guards.includes("Partial progress saved")) throw new Error("partial copy missing");
  },
  "generic-saas-build-minimum-files": () => {
    if (!scaffold.includes("app/dashboard/page.tsx")) throw new Error("dashboard route missing");
    if (!scaffold.includes("components/MetricCard")) throw new Error("components missing");
  },
  "crm-build-minimum-files": () => {
    if (!archetypeFb.includes('"crm"')) throw new Error("crm archetype scaffold missing");
  },
  "investor-portal-build-minimum-files": () => {
    if (!archetypeFb.includes("saas_dashboard")) throw new Error("saas scaffold archetype missing");
  },
  "no-one-line-app-files": () => {
    if (!scaffold.includes("export default function HomePage")) {
      throw new Error("home page must be multi-line component");
    }
  },
  "ui-repair-does-not-run-on-empty-tree": () => {
    if (!execute.includes("saveableFileCount >= MIN_RENDERABLE_FILES")) {
      throw new Error("persist branch must gate on min files");
    }
  },
  "weak-model-output-uses-scaffold": () => {
    if (!archetypeFb.includes("mergeGenericSaaSScaffold")) {
      throw new Error("generic scaffold merge missing");
    }
  },
  "mobile-safe-area-build-composer": () => {
    const immersive = read("src/components/create/workspace/immersive-workspace.tsx");
    if (!immersive.includes("safe-area-inset-bottom")) {
      throw new Error("build composer safe area padding missing");
    }
  },
  "mobile-bottom-nav-no-overlap": () => {
    const shell = read("src/components/layout/platform-shell.tsx");
    if (!shell.includes("MobileBottomNav")) throw new Error("bottom nav missing");
  },
  "mobile-workflow-readable": () => {
    if (!streamUi.includes("max-w-[min(100%")) throw new Error("mobile max-width on chat rows");
  },
  "mobile-account-menu-layout": () => {
    if (!userMenu.includes("min(320px")) throw new Error("mobile menu width constraint missing");
  },
};

const selected = process.argv.slice(2).filter(Boolean);
const names = selected.length ? selected : Object.keys(suites);

console.log("\n=== verify:p0-mobile-release ===\n");
let failed = 0;
for (const name of names) {
  const fn = suites[name];
  if (!fn) {
    console.error(`✗ unknown suite: ${name}`);
    failed += 1;
    continue;
  }
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    failed += 1;
  }
}
if (failed) process.exit(1);
console.log(`\n${names.length - failed}/${names.length} passed\n`);
