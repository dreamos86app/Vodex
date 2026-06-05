#!/usr/bin/env node
/**
 * Verifies plan credit economics, allowances, pricing copy, and runtime metering guards.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function mustInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of Array.isArray(needles) ? needles : [needles]) {
    if (!text.includes(n)) errors.push(`${label}: missing "${n}" in ${rel}`);
  }
}

function mustNotInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of Array.isArray(needles) ? needles : [needles]) {
    if (text.includes(n)) errors.push(`${label}: stale "${n}" in ${rel}`);
  }
}

// Part 0 economics constants
const econ = read("src/lib/billing/plan-credit-economics.ts");
const allowances = { free: 20, starter: 420, pro: 1125, infinity: 2350 };
for (const [plan, ac] of Object.entries(allowances)) {
  const underscored = ac >= 1000 ? `${Math.floor(ac / 1000)}_${String(ac % 1000).padStart(3, "0")}` : String(ac);
  if (!new RegExp(`${plan}:\\s*(${ac}|${underscored})`).test(econ)) {
    errors.push(`plan-credit-economics: ${plan} action credits should be ${ac}`);
  }
}
ok.push("action credit allowances by plan");

mustNotInclude(
  "src/lib/billing/plan-credit-economics.ts",
  ["pro: 2000", "pro: 2_000", "infinity: 10000", "infinity: 10_000", "business: 5000"],
  "stale allowances",
);

// Pricing formula
mustInclude("src/lib/action-credits/action-credit-pricing.ts", "ACTION_PROVIDER_USD_PER_CREDIT", "action pricing import");
mustInclude("src/lib/billing/plan-credit-economics.ts", "ACTION_PROVIDER_USD_PER_CREDIT = 0.005", "action provider budget");
mustInclude("src/lib/action-credits/action-credit-pricing.ts", "Math.ceil(providerCostUsd / ACTION_PROVIDER_USD_PER_CREDIT)", "ceil formula");

// Paddle economics
mustInclude("src/lib/billing/plan-credit-economics.ts", "PADDLE_FEE_PERCENT = 0.05", "paddle fee");
mustInclude("src/lib/billing/paddle-billing.ts", "PADDLE_API_KEY", "paddle billing");

// Pro profit ~ $30
if (!econ.includes("profitUsd") || !econ.includes("computePlanEconomics")) {
  errors.push("plan economics compute missing");
} else {
  ok.push("plan economics compute");
}

// Video draft
mustInclude("src/lib/action-credits/video-draft-pricing.ts", "DRAFT_VIDEO_5S_ACTION_CREDITS = 58", "video draft 5s");
mustInclude("src/lib/action-credits/video-draft-pricing.ts", "0.25", "video provider target");

// No Sora default
mustInclude("src/lib/media/dreamos-media-router.ts", "DISALLOWED_DEFAULT_VIDEO_PROVIDERS", "no sora");
if (/defaultRoute:\s*["']sora/i.test(read("src/lib/media/dreamos-media-router.ts"))) {
  errors.push("sora default route configured");
}

// Image small/medium only default
mustInclude("src/lib/media/dreamos-media-router.ts", "image_simple", "image small route");
mustInclude("src/lib/media/dreamos-media-router.ts", "Premium image route is not allowed", "block premium default");

// Logo precheck before provider
mustInclude("src/lib/projects/app-identity-service.ts", "assertActionCreditsAffordable", "logo precheck");
const identity = read("src/lib/projects/app-identity-service.ts");
const regenIdx = identity.indexOf("export async function regenerateAppLogo");
const regenBody = regenIdx > 0 ? identity.slice(regenIdx, regenIdx + 2500) : "";
const chargeBeforeGen =
  regenBody.includes("const charge = await chargeActionCredit") &&
  regenBody.includes("const logo = await generateAppLogo") &&
  regenBody.indexOf("const charge = await chargeActionCredit") <
    regenBody.indexOf("const logo = await generateAppLogo");
if (!chargeBeforeGen) errors.push("regenerateAppLogo must charge before generateAppLogo");
else ok.push("logo charge before provider");

// Runtime owner metering
mustInclude("src/lib/action-credits/runtime-owner-metering.ts", "meterRuntimeActionForOwner", "runtime owner meter");
mustInclude("src/lib/contact/save-contact-request.ts", "meterRuntimeActionForOwner", "contact charges owner");

// Pricing page copy
mustInclude("src/components/pricing/pricing-view.tsx", "planPricingCardCopy", "pricing card copy");
mustInclude("src/lib/billing/plan-credit-economics.ts", "pro: 1_125", "pro action credits allowance");
mustInclude("src/components/pricing/pricing-view.tsx", "planPricingCardCopy(\"pro\")", "pro pricing card");

// Help docs
mustInclude("src/lib/docs.ts", "action-credits-overview", "help action credits");
mustInclude("src/lib/docs.ts", "dreamos86-paddle-billing", "help paddle");

// Admin monitoring
mustInclude("src/app/api/admin/credit-economy/route.ts", "planEconomics", "admin plan economics");

// No provider cost client (reuse existing check snippet)
const pricingView = read("src/components/pricing/pricing-view.tsx");
if (/provider_cost_usd|providerCostUsd|ACTION_PROVIDER_USD/.test(pricingView)) {
  errors.push("pricing-view must not expose provider cost to users");
} else ok.push("pricing page no provider cost");

console.log("\n=== verify:plan-credit-economics ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
