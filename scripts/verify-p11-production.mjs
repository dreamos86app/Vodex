#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv[2] ?? "";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

const suites = {
  "no-malformed-try-block": () => {
    const errors = [];
    must(read("src/lib/preview/preview-html-sanitizer.ts"), "hasMalformedTryBlock", "try validator", errors);
    must(read("src/lib/preview/static-preview-builder.ts"), "preview-html-sanitizer", "sanitizer wired", errors);
    return errors;
  },
  "builder-route-no-syntax-crash": () => {
    const errors = [];
    must(read("src/lib/preview/preview-html-sanitizer.ts"), "stripInlineScriptsFromPreviewBody", "strip scripts", errors);
    must(read("src/components/create/builder-project-gate.tsx"), "ImmersiveWorkspace", "builder gate", errors);
    return errors;
  },
  "credit-empty-upgrade-panel": () => {
    const errors = [];
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "build-credits-upgrade-panel", "panel", errors);
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "#2563eb", "vodex blue", errors);
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "build-credits-upgrade-panel__cta", "premium cta", errors);
    const panel = read("src/components/billing/build-credits-upgrade-panel.tsx");
    if (panel.includes("Add credits")) errors.push("add credits removed");
    if (panel.includes("Save for later")) errors.push("save for later removed");
    must(read("src/lib/billing/build-credits-upgrade.ts"), "resolveBuildCreditsUpgradeOffer", "offer resolver", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "BuildCreditsUpgradePanel", "workspace panel", errors);
    return errors;
  },
  "pricing-card-clicks-checkout": () => {
    const errors = [];
    const pv = read("src/components/pricing/pricing-view.tsx");
    must(pv, "cursor-pointer", "clickable cards", errors);
    must(pv, "activateCard", "card activation", errors);
    must(pv, "startCheckout", "checkout hook", errors);
    must(pv, "e.stopPropagation", "button click isolation", errors);
    return errors;
  },
  "icon-action-credit-charge": () => {
    const errors = [];
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_reserved", "reserve log", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_charged", "charge log", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "chargeActionCredit", "charge call", errors);
    must(read("src/lib/action-credits/charge-action-credit.ts"), "dynamicFloor", "dynamic floor", errors);
    return errors;
  },
  "icon-symbolic-full-circle": () => {
    const errors = [];
    must(read("src/lib/projects/app-logo-generation.ts"), "validateIconVisualQuality", "visual validation", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "symbolic mark only", "no text prompt", errors);
    must(read("src/lib/projects/app-identity-service.ts"), "icon_credit_skipped_depleted", "depleted skip log", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "scaleIconVisualMass", "visual mass", errors);
    return errors;
  },
  "intro-v2-cinematic-app-showcase": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    const mocks = read("src/components/session/intro-showcase-mocks.tsx");
    must(intro, "INTRO_SHOWCASE_MOCKS", "showcase mocks wired", errors);
    must(intro, "SHOWCASE_MS", "2.5s showcase timing", errors);
    must(mocks, "FashionStoreMock", "fashion mock", errors);
    must(mocks, "FoodDeliveryMock", "food mock", errors);
    must(mocks, "VideoEditorMock", "video mock", errors);
    must(mocks, "FinanceMock", "finance mock", errors);
    must(read("src/components/session/intro-falling-stars.tsx"), "IntroFallingStars", "stars", errors);
    return errors;
  },
  "intro-no-start-artifact": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    if (intro.includes("vodex-premium-intro__icon-wrap") && intro.includes("animate")) {
      errors.push("legacy icon-wrap animation should not run at t=0");
    }
    must(intro, "initial={{ opacity: 1 }}", "no flash fade-in from 0 on root", errors);
    must(intro, "vodex-intro-v2", "v2 shell class", errors);
    must(read("src/app/globals.css"), "vodex-intro-v2__sky", "sky gradient", errors);
    return errors;
  },
  "intro-mobile-desktop-variants": () => {
    const errors = [];
    must(read("src/components/session/vodex-session-intro.tsx"), "isMobile", "mobile layout", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "innerWidth < 768", "breakpoint", errors);
    return errors;
  },
  "no-generic-credit-toast": () => {
    const errors = [];
    const imm = read("src/components/create/workspace/immersive-workspace.tsx");
    if (imm.includes('toast.error("Out of build credits')) {
      errors.push("generic bottom-right build credit toast removed");
    }
    must(imm, "BuildCreditsUpgradePanel", "inline upgrade panel", errors);
    return errors;
  },
};

if (!suites[check]) {
  console.error(`Unknown check: ${check}`);
  process.exit(1);
}

const errors = suites[check]();
console.log(`\n=== verify:${check} ===\n`);
if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ OK");
