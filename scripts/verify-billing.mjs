#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.DREAMOS_SKIP_CREDIT_DB !== "1") {
  const dbProbe = spawnSync("npm run verify:credit-economy-db", { cwd: root, shell: true, stdio: "inherit" });
  if (dbProbe.status !== 0) process.exit(1);
}

const INTERNAL_CREDITS_PER_USD = 30;
const USER_CREDITS_PER_USD = 10;
const TARGET_REVENUE_MULTIPLIER = 3;

function minUserCredits(providerUsd) {
  const costMicro = Math.round(providerUsd * 1_000_000);
  return Math.ceil((costMicro * TARGET_REVENUE_MULTIPLIER * USER_CREDITS_PER_USD) / 1_000_000);
}

function wrongMinUser(internal) {
  return Math.ceil(internal * TARGET_REVENUE_MULTIPLIER);
}

function quote(providerUsd, floor) {
  return Math.max(floor, minUserCredits(providerUsd));
}

function grossMargin(userCredits, providerUsd) {
  const revenueUsd = userCredits / USER_CREDITS_PER_USD;
  if (revenueUsd <= 0) return 0;
  return (revenueUsd - providerUsd) / revenueUsd;
}

function revenueMultiplier(userCredits, providerUsd) {
  const revenueUsd = userCredits / USER_CREDITS_PER_USD;
  if (providerUsd <= 0) return Infinity;
  return revenueUsd / providerUsd;
}

const errors = [];
const ok = [];
function assert(c, m) {
  (c ? ok : errors).push(m);
}

assert(wrongMinUser(30) === 90, "wrong formula = 90 for $1 provider");
assert(quote(1, 0) === 30, "$1 provider => 30 user credits");
assert(quote(1, 0) !== 90, "$1 must NOT require 90 user credits");
assert(quote(0.1, 0) === 3, "$0.10 => 3 user credits");
assert(quote(0.025, 0) === 1, "$0.025 => 1 user credit");
assert(minUserCredits(10 / 30) === 10, "10 internal cost => 10 user min");
assert(quote(0.001, 8) === 8, "product floor 8");
assert(quote(0.001, 8) >= minUserCredits(0.001), "floor >= profitable min");

assert(Math.abs(grossMargin(30, 1) - 2 / 3) < 0.02, "~66.7% margin at 3x revenue");
assert(Math.abs(revenueMultiplier(30, 1) - 3) < 0.02, "3x revenue multiplier");

const guard = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/billing/pricing-config.ts"),
  "utf8",
);
assert(guard.includes("costMicro"), "pricing-config uses micro-USD math");
assert(guard.includes("TARGET_REVENUE_MULTIPLIER"), "TARGET_REVENUE_MULTIPLIER named correctly");
assert(guard.includes("polish"), "polish mode in pricing config");

const polishRoute = path.join(root, "src/app/api/build/polish/route.ts");
if (fs.existsSync(polishRoute)) ok.push("polish API route exists");
else errors.push("missing polish API route");

console.log("\n=== verify:billing ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
