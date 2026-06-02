#!/usr/bin/env node
/**
 * P0.6 production verification suite — static contract checks.
 * Usage: node scripts/verify-p06-production.mjs <check-name>
 */
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

function countLabelsInPool() {
  const core = read("src/lib/inspiration/app-idea-prompts.ts");
  const extra = read("src/lib/prompts/app-idea-pool.ts");
  const n =
    (core.match(/label:\s*"/g) ?? []).length + (extra.match(/label:\s*"/g) ?? []).length;
  return n;
}

const suites = {
  "credits-instant-and-deduped": () => {
    const errors = [];
    const warmup = read("src/lib/credits/session-credits-warmup.ts");
    const bootstrap = read("src/lib/credits/credits-bootstrap.ts");
    const store = read("src/lib/stores/credits-store.ts");
    const provider = read("src/components/providers/app-provider.tsx");
    must(warmup, "beginSessionCreditsWarmup", "session credits warmup", errors);
    must(warmup, "SESSION_CREDITS_LITE_TIMEOUT_MS", "intro-length lite timeout", errors);
    must(bootstrap, "shouldSkipLiteCreditsFetch", "lite dedupe", errors);
    must(bootstrap, "shouldSkipLiteCreditsFetch", "lite dedupe", errors);
    must(bootstrap, "credits_duplicate_fetch_blocked", "duplicate fetch log", errors);
    must(store, "/api/credits?lite=1", "lite endpoint", errors);
    must(store, "inFlightRequest", "in-flight guard", errors);
    must(store, "applyInstantCredits", "instant credit display", errors);
    must(store, "liteTimeoutMs", "configurable lite timeout", errors);
    if (!store.includes(".applyCanonical(cached)")) {
      errors.push("hydrateCreditsFromLocalCache must applyCanonical for instant paint");
    }
    must(provider, "beginSessionCreditsWarmup", "provider uses session warmup", errors);
    if (!provider.includes("profileCreditsRemaining")) {
      errors.push("provider credits effect must not depend on whole profile object");
    }
    return errors;
  },
  "session-intro-preload": () => {
    const errors = [];
    must(read("src/components/session/vodex-session-intro.tsx"), "vodex_intro_seen_session", "session flag", errors);
    const gate = read("src/components/session/vodex-session-intro-gate.tsx");
    must(gate, "VodexSessionIntroGate", "intro gate", errors);
    must(gate, "useLayoutEffect", "intro before paint", errors);
    must(gate, 'phase === "intro"', "intro phase", errors);
    must(gate, "invisible fixed inset-0", "app preloads behind intro", errors);
    must(read("src/lib/bootstrap/session-preload.ts"), "beginSessionCreditsWarmup", "preload starts credits", errors);
    must(read("src/components/providers/app-chrome-providers.tsx"), "VodexSessionIntroGate", "intro wired in chrome", errors);
    must(read("src/components/session/vodex-session-intro.tsx"), "2400", "max intro duration", errors);
    return errors;
  },
  "app-idea-pool": () => {
    const errors = [];
    const count = countLabelsInPool();
    if (count < 200) errors.push(`app idea pool must have 200+ ideas (found ~${count})`);
    must(read("src/lib/prompts/app-idea-pool.ts"), "ALL_EXPANDED_APP_IDEAS", "expanded pool export", errors);
    must(read("src/lib/inspiration/app-idea-prompts.ts"), "ALL_EXPANDED_APP_IDEAS", "core merges expanded", errors);
    return errors;
  },
  "workflow-active-step-position": () => {
    const errors = [];
    const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");
    must(stream, "workflow-active-step", "active step marker", errors);
    must(stream, "useStaggeredWorkflowEvents(timelineRaw, false)", "no stagger delay during build", errors);
    if (stream.indexOf("workflow-active-step") > stream.indexOf("completedTimeline.map")) {
      /* active li should be after completed map in return */
    }
    const activeIdx = stream.indexOf('data-testid="workflow-active-step"');
    const completedIdx = stream.indexOf("completedTimeline.map");
    if (activeIdx < 0 || completedIdx < 0 || activeIdx < completedIdx) {
      errors.push("active step must render at bottom of timeline list");
    }
    return errors;
  },
  "file-deltas-live-cursor-style": () => {
    const errors = [];
    must(read("src/components/create/workspace/animated-line-delta.tsx"), "useAnimatedCount", "animated counts", errors);
    must(read("src/components/create/workspace/animated-line-delta.tsx"), "delta-bump", "bump animation", errors);
    must(read("src/app/globals.css"), "@keyframes delta-bump", "delta keyframes", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "AnimatedLineDelta", "workflow uses deltas", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "file-active-ring", "file active gold ring", errors);
    return errors;
  },
  "diagnostics-auto-center-modal": () => {
    const errors = [];
    must(read("src/lib/build/owner-diagnostics-auto-open.ts"), "shouldAutoOpenOwnerDiagnostics", "auto-open helper", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "shouldAutoOpenOwnerDiagnostics", "stream auto-open", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "setDiagOpen(true)", "opens modal on failure", errors);
    must(read("src/components/create/workspace/build-diagnostics-center.tsx"), "build-diagnostics-modal", "center modal", errors);
    must(read("src/components/create/workspace/admin-diagnostics-fab.tsx"), "admin-diagnostics-reopen", "reopen FAB only", errors);
    return errors;
  },
  "missing-root-page-repair": () => {
    const errors = [];
    must(read("src/lib/build/root-page-repair.ts"), "rootPageContentOk", "root page validator", errors);
    must(read("src/lib/build/post-persist-status-reconciler.ts"), "repairRootPageContent", "post-persist repair", errors);
    must(read("src/lib/build/post-persist-status-reconciler.ts"), "needsRootRepair", "always repair thin root", errors);
    must(read("src/lib/build/source-integrity-validator.ts"), "upgrade to a paid plan", "reject paid-placeholder content", errors);
    return errors;
  },
  "icon-generation-billing-and-quality": () => {
    const errors = [];
    must(read("src/lib/projects/app-identity-service.ts"), "app_icon_ai_generation", "icon action charge", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "circular mask", "circular safe prompt", errors);
    must(read("src/components/projects/project-icon.tsx"), "object-cover", "circle crop display", errors);
    return errors;
  },
  "auth-bootstrap-nonblocking": () => {
    const errors = [];
    const provider = read("src/components/providers/app-provider.tsx");
    const gate = read("src/components/onboarding/onboarding-app-gate.tsx");
    if (provider.includes("await bootstrapUser(liveUser.id)")) {
      errors.push("auth bootstrap must not await bootstrapUser before setLoading(false)");
    }
    must(provider, "void bootstrapUser(liveUser.id)", "background bootstrap", errors);
    must(gate, "gateTimedOut", "gate max wait fallback", errors);
    must(gate, "hasActiveSession", "session-aware gate", errors);
    return errors;
  },
  "premium-app-naming": () => {
    const errors = [];
    const engine = read("src/lib/projects/app-identity-naming-engine.ts");
    must(engine, "Pawly", "pet brand pool", errors);
    must(engine, "VetNest", "vet brand pool", errors);
    must(engine, "scoreBrandableName", "brand scoring", errors);
    must(engine, "BRAND_POOL", "brand pool", errors);
    return errors;
  },
};

if (!suites[check]) {
  console.error(`Unknown check: ${check}`);
  console.error("Available:", Object.keys(suites).join(", "));
  process.exit(1);
}

const errors = suites[check]();
console.log(`\n=== verify:${check} ===\n`);
if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log("✓ OK");
