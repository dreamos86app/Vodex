#!/usr/bin/env node
/**
 * P1.0 production verification — product intelligence, UI richness, cinematic intro.
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

const suites = {
  "dashboard-richness": () => {
    const errors = [];
    must(read("src/lib/build/dashboard-quality-validator.ts"), "dashboardQualityScore", "dashboard scorer", errors);
    must(read("src/lib/build/dashboard-quality-validator.ts"), "DASHBOARD_QUALITY_MIN_SCORE", "min score 85", errors);
    must(read("src/lib/build/generated-ui-quality-checker.ts"), "dashboardQualityScore", "checker uses dashboard", errors);
    return errors;
  },
  "ui-density": () => {
    const errors = [];
    must(read("src/lib/build/ui-richness-validator.ts"), "validateUiRichness", "richness validator", errors);
    must(read("src/lib/build/ui-richness-validator.ts"), "UI_RICHNESS_MIN_SCORE", "min richness", errors);
    return errors;
  },
  "charts-present": () => {
    const errors = [];
    must(read("src/lib/build/dashboard-quality-validator.ts"), "countCharts", "chart detection", errors);
    must(read("src/lib/build/build-feature-expansion.ts"), "traffic + sales charts", "launchpad charts spec", errors);
    return errors;
  },
  "mock-data-quality": () => {
    const errors = [];
    must(read("src/lib/build/product-intelligence-expansion.ts"), "mockDataGuidance", "mock data guidance", errors);
    must(read("src/lib/build/dashboard-quality-validator.ts"), "mockDataSignals", "mock data heuristics", errors);
    return errors;
  },
  "launchpad-mvp-quality": () => {
    const errors = [];
    must(read("src/lib/build/app-archetype-classifier.ts"), "product_launch_pad", "launchpad archetype", errors);
    must(read("src/lib/build/build-feature-expansion.ts"), "product_launch_pad", "launchpad expansion", errors);
    must(read("src/lib/build/product-intelligence-expansion.ts"), "launchPadBrief", "launchpad intelligence", errors);
    return errors;
  },
  "intro-cinematic-sequence": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    must(intro, "vodex-cinematic-intro", "cinematic shell", errors);
    must(intro, "framer-motion", "motion driven", errors);
    must(intro, "IntroUiFlashes", "UI flash cuts", errors);
    must(intro, "Building intelligent apps", "tagline", errors);
    must(read("src/app/globals.css"), "vodex-cinematic-intro__nebula", "nebula layer", errors);
    return errors;
  },
  "intro-performance-budget": () => {
    const errors = [];
    const intro = read("src/components/session/vodex-session-intro.tsx");
    if (intro.includes(".mp4") || intro.includes("lottie")) {
      errors.push("intro must not use video/lottie payloads");
    }
    must(intro, "useReducedMotion", "reduced motion", errors);
    must(read("src/app/globals.css"), "will-change", "gpu hints", errors);
    return errors;
  },
  "file-streaming-persistence-feel": () => {
    const errors = [];
    must(read("src/lib/build/persist-generated-files.ts"), "setTimeout", "persist pacing delay", errors);
    must(read("src/components/create/workspace/animated-line-delta.tsx"), "STEP_MS = 120", "120ms step deltas", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "batchPersistStagger", "batch stagger", errors);
    return errors;
  },
  "icon-brand-quality": () => {
    const errors = [];
    must(read("src/lib/projects/app-logo-generation.ts"), "scaleIconVisualMass", "visual mass", errors);
    must(read("src/lib/projects/app-logo-generation.ts"), "symbolic mark only", "no logotype", errors);
    return errors;
  },
  "no-fake-done-copy": () => {
    const errors = [];
    must(read("src/lib/build/execute-staged-build-job.ts"), "Done — preview is ready", "honest done copy", errors);
    must(read("src/lib/build/workflow-status-guards.ts"), "Done — preview is ready", "UI done headline", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "additional generation needed", "weak draft copy", errors);
    must(read("src/lib/build/build-pipeline.ts"), "expandProductIntelligence", "product intelligence", errors);
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
