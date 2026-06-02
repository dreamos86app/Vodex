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
    must(intro, "INTRO_V3_APPS", "v3 apps wired", errors);
    must(intro, "data-intro-version=\"v3\"", "v3 marker", errors);
    return errors;
  },
  "intro-real-app-screens": () => {
    const errors = [];
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "intro-v3-app-screens", "v3 screens import", errors);
    must(screens, "IntroFashionScreen", "fashion full screen", errors);
    must(screens, "IntroFoodDeliveryScreen", "food full screen", errors);
    must(screens, "IntroVideoEditorScreen", "video full screen", errors);
    must(screens, "IntroFinanceScreen", "finance full screen", errors);
    must(screens, "DesktopChrome", "desktop chrome", errors);
    must(screens, "PhoneChrome", "mobile chrome", errors);
    must(screens, "data-intro-app=", "real app markers", errors);
    return errors;
  },
  "intro-no-placeholder-ui": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    if (intro.includes("INTRO_SHOWCASE_MOCKS")) errors.push("v2 floating mocks removed from intro");
    if (intro.includes("ShowcaseSquare")) errors.push("tiny floating cards removed");
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    must(screens, "<header", "nav density — fashion", errors);
    must(screens, "Checkout", "checkout cta", errors);
    must(screens, "Timeline", "editor timeline", errors);
    must(screens, "Stripe payout", "finance transactions", errors);
    return errors;
  },
  "intro-premium-motion": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "PHASE_MONTAGE_END", "phased montage", errors);
    must(intro, "PHASE_COLLAPSE_END", "phased collapse", errors);
    must(intro, "IntroV3Collapse", "collapse burst", errors);
    must(intro, "QuadrantApp", "quadrant layout", errors);
    must(read("src/app/globals.css"), "vodex-intro-v3__chromatic", "chromatic layer", errors);
    return errors;
  },
  "intro-desktop-mobile-density": () => {
    const errors = [];
    const screens = read("src/components/session/intro-v3-app-screens.tsx");
    must(screens, "data-intro-density=\"desktop-framed\"", "desktop density", errors);
    must(screens, "data-intro-density=\"mobile-framed\"", "mobile density", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "QuadrantApp", "quadrant frames", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), '"mobile" : "desktop"', "layout switch", errors);
    return errors;
  },
  "admin-prompt-stats-filter-cost": () => {
    const errors = [];
    must(read("src/lib/admin/admin-query-compat.ts"), "AiUsageCostBucket", "cost bucket type", errors);
    must(read("src/lib/admin/admin-query-compat.ts"), "buckets", "bucket aggregates", errors);
    must(read("src/app/api/admin/ai-usage/prompt-stats/route.ts"), "buckets", "api buckets", errors);
    const panel = read("src/components/admin/admin-prompt-activity-panel.tsx");
    must(panel, "Provider cost", "provider cost ui", errors);
    must(panel, "Est. margin", "margin ui", errors);
    if (panel.includes("Add credits")) errors.push("duplicate add credits");
    if (panel.includes("Successful live")) errors.push("duplicate pill filters removed");
    return errors;
  },
  "admin-build-success-fail-counts": () => {
    const errors = [];
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Total builds", "build total", errors);
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Successful builds", "build success", errors);
    must(read("src/components/admin/admin-prompt-activity-panel.tsx"), "Failed builds", "build failed", errors);
    must(read("src/lib/admin/admin-query-compat.ts"), "builds:", "build stats in compat", errors);
    must(read("src/lib/ai/log-provider-ai-usage.ts"), "isBuildRelatedUsageMode", "build mode helper", errors);
    return errors;
  },
  "ai-usage-logging-coverage": () => {
    const errors = [];
    must(read("src/lib/ai/log-provider-ai-usage.ts"), "logProviderAiUsage", "provider logger", errors);
    must(read("src/lib/ai/provider-call.ts"), "logProviderAiUsage", "wired in provider-call", errors);
    must(read("src/lib/credits/charge-ai-operation.ts"), "ai_usage_logs", "chat charge logs", errors);
    must(read("src/lib/billing/build-credit-audit-log.ts"), "logBuildCreditReconciliation", "build reconcile log", errors);
    return errors;
  },
  "deploy-with-prompt-flow": () => {
    const errors = [];
    const imm = read("src/components/create/workspace/immersive-workspace.tsx");
    must(imm, "PublishModal", "publish modal in builder", errors);
    must(imm, "publish_request", "publish intent handling", errors);
    must(imm, "setPublishOpen(true)", "opens publish modal", errors);
    must(read("src/app/api/projects/[id]/publish/route.ts"), "startPublish", "publish api", errors);
    return errors;
  },
  "intro-app-previews-visible-before-vortex": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "PREVIEW_START", "preview start delay", errors);
    must(intro, "previewsVisible", "previews visible gate", errors);
    must(intro, "PHASE_MONTAGE_END", "montage end before vortex", errors);
    must(intro, "INTRO_V3_APPS.map", "four apps at once", errors);
    return errors;
  },
  "intro-vortex-after-previews": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "IntroV3Collapse", "vortex collapse", errors);
    must(intro, "collapsing", "collapse phase", errors);
    if (intro.includes("CUT_DURATION")) errors.push("sequential cuts removed for quadrant montage");
    return errors;
  },
  "intro-no-start-artifact": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "initial={{ opacity: 1 }}", "no flash fade-in from 0 on root", errors);
    must(intro, "vodex-intro-v3", "v3 shell class", errors);
    must(intro, "showBrand", "brand gated until phase 3", errors);
    must(read("src/app/globals.css"), "vodex-intro-v3__cosmos", "cosmos fill", errors);
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
