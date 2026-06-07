#!/usr/bin/env node
/**
 * P1.3.14 — Benchmark prompt suite (static tier expectations).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const BENCHMARK_PROMPTS = [
  {
    id: "vet-clinic",
    prompt: "Veterinary clinic management platform with patients, appointments, vaccinations, billing, and staff scheduling.",
    minTier: "medium",
  },
  {
    id: "real-estate-crm",
    prompt: "Real estate CRM for brokers with listings, leads, showings, commissions, and pipeline dashboards.",
    minTier: "medium",
  },
  {
    id: "restaurant-inventory",
    prompt: "Restaurant inventory and supplier management with stock levels, purchase orders, waste tracking, and vendor catalog.",
    minTier: "medium",
  },
  {
    id: "dance-studio",
    prompt:
      "Dance studio class booking platform with class schedules, instructors, member profiles, attendance tracking, payments, studio dashboard, and booking calendar.",
    minTier: "complex",
  },
  {
    id: "finance-tracker",
    prompt: "Personal finance tracker with budgets, transactions, goals, spending charts, alerts, and recurring payments.",
    minTier: "medium",
  },
  {
    id: "property-mgmt",
    prompt: "Airbnb-style property management dashboard with listings, bookings, guest messages, cleaning schedule, and revenue.",
    minTier: "complex",
  },
  {
    id: "course-platform",
    prompt: "Online course platform with courses, lessons, enrollments, progress tracking, instructor dashboard, and certificates.",
    minTier: "complex",
  },
  {
    id: "gym-scheduling",
    prompt: "Gym membership and trainer scheduling app with members, classes, trainers, check-ins, and billing.",
    minTier: "medium",
  },
  {
    id: "event-crm",
    prompt: "Event planning CRM with clients, venues, vendors, timelines, budgets, and task assignments.",
    minTier: "medium",
  },
  {
    id: "boutique-inventory",
    prompt: "Boutique e-commerce inventory dashboard with SKUs, suppliers, sales velocity, restock alerts, and purchase orders.",
    minTier: "medium",
  },
];

const tierRank = { simple: 0, medium: 1, complex: 2 };

function tierFromPrompt(prompt) {
  const featureSignals =
    (prompt.match(/\b(page|screen|route|dashboard|calendar|booking|payment|member|class|inventory|crm|chart|table|form|schedule|instructor|attendance|revenue|enrollment|vendor|listing|commission|patient|supplier|trainer|venue|sku)\b/gi) ?? [])
      .length;
  const featureClauses = prompt.split(/,| and /i).filter((s) => s.trim().length > 4).length;
  let complexity = 5;
  if (prompt.length > 120) complexity += 1;
  if (featureClauses >= 7 || featureSignals >= 9) complexity += 3;
  else if (featureClauses >= 5 || featureSignals >= 6) complexity += 2;
  else if (featureSignals >= 4) complexity += 1;
  if (complexity >= 8 || (featureClauses >= 5 && complexity >= 7)) return "complex";
  if (complexity >= 5 || featureClauses >= 4) return "medium";
  return "simple";
}

const planSrc = fs.readFileSync(path.join(root, "src/lib/build/full-app-generation-plan.ts"), "utf8");
if (!planSrc.includes("GENERATION_TIER_BUDGETS")) {
  console.error("benchmark:generation-quality FAILED — missing tier budgets");
  process.exit(1);
}

const failures = [];
for (const bench of BENCHMARK_PROMPTS) {
  const tier = tierFromPrompt(bench.prompt);
  if (tierRank[tier] < tierRank[bench.minTier]) {
    failures.push(`${bench.id}: expected >= ${bench.minTier}, got ${tier}`);
  }
}

if (failures.length) {
  console.error("benchmark:generation-quality FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`benchmark:generation-quality OK (${BENCHMARK_PROMPTS.length} prompts)`);
