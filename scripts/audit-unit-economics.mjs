#!/usr/bin/env node
/**
 * Vodex unit economics audit — configurable assumptions, no faked profit.
 * Run: npm run audit:unit-economics
 */
import {
  compareEconomics,
  DEFAULT_ASSUMPTIONS,
  actionCreditsFor5x,
  actionRevenueUsdPerCredit,
  discussMarginAtBc,
  planMaxBurnMargin,
} from "./lib/unit-economics-model.mjs";

const report = compareEconomics(DEFAULT_ASSUMPTIONS);
const a = report.assumptions;

console.log("=== Vodex Unit Economics Audit (P5.4.4) ===\n");
console.log("ASSUMPTIONS (full):");
console.log(JSON.stringify(a, null, 2));

console.log("\n--- Per-unit costs ---");
console.log(`Discuss message (${a.discussInputTokens} in / ${a.discussOutputTokens} out, ${a.discussModelId}): $${report.discussCostUsd.toFixed(6)}`);
console.log(`Discuss margin at 0.3 BC: ${report.discussMarginAt03.toFixed(1)}x`);
console.log(`Discuss margin at 0.4 BC: ${report.discussMarginAt04.toFixed(1)}x`);
console.log(
  `Discuss recommendation: ${report.discussRecommendation.credits} BC (${report.discussRecommendation.margin.toFixed(1)}x margin)`,
);
console.log(`Build Credit revenue equivalent: $${report.buildCreditRevenueUsd.toFixed(4)} / BC`);
console.log(`Action Credit revenue (Starter baseline): $${report.actionCreditRevenueUsdStarter.toFixed(4)} / AC`);
console.log(`Build Credit max provider pool: $${a.providerUsdPerBuildCredit} / BC`);
console.log(`Action Credit max provider pool: $${a.providerUsdPerActionCredit} / AC`);

console.log("\n--- Action pricing (5x minimum @ Starter revenue/AC) ---");
for (const [key, row] of Object.entries(report.actionPricing)) {
  console.log(
    `  ${key}: provider $${row.providerCostUsd.toFixed(4)} → ${row.creditsAt5x} AC minimum`,
  );
}

console.log("\n--- Infrastructure action estimates ---");
console.log(`ZIP preview (tier 2): $${a.actionCostsUsd.zipPreviewTier2}`);
console.log(`ZIP preview (tier 4): $${a.actionCostsUsd.zipPreviewTier4}`);
console.log(`Android build: $${a.actionCostsUsd.androidBuild}`);
console.log(`Logo generation: $${a.actionCostsUsd.logoGeneration}`);
console.log(`Image standard: $${a.actionCostsUsd.imageStandard}`);
console.log(`Runtime LLM small: $${a.actionCostsUsd.runtimeLlmSmall}`);

console.log("\n--- Free user worst-case monthly cost ---");
console.log(`$${report.freeUserMaxMonthlyCost.toFixed(4)} (100% allowance + ~30 discuss turns)`);
console.log(
  `Realistic active free users: ${a.freeActiveCreditUsersPerMonth} @ ${(a.freeCreditUtilization * 100).toFixed(0)}% util`,
);
console.log(
  `  → $${(report.freeUserMaxMonthlyCost * a.freeCreditUtilization * a.freeActiveCreditUsersPerMonth).toFixed(2)} / month platform COGS`,
);

console.log("\n--- Paid plan margin table (max burn vs blended) ---");
for (const plan of ["starter", "pro", "infinity_i"]) {
  const row = report.new.planMargins[plan];
  console.log(
    `  ${plan}: $${row.price} | ${row.buildCredits} BC + ${row.actionCredits} AC | max-burn margin ${row.maxBurnMarginPct.toFixed(1)}% | blended ${row.blendedMarginPct.toFixed(1)}%`,
  );
}

console.log("\n--- Gross margin summary ---");
console.log(`OLD blended gross margin: ${report.currentGrossMarginPct.toFixed(1)}%`);
console.log(`NEW blended gross margin: ${report.newGrossMarginPct.toFixed(1)}%`);
console.log(`Target: ${a.targetGrossMarginPercent}%+`);

console.log("\n--- Recommended allowances ---");
for (const plan of ["free", "starter", "pro", "infinity_i"]) {
  console.log(
    `  ${plan}: ${a.buildCreditsByPlan[plan]} BC / ${a.actionCreditsByPlan[plan]} AC`,
  );
}

console.log("\n--- Monthly steady-state (new allowances, blended util) ---");
console.log(`MRR: $${report.new.mrr.toFixed(2)}`);
console.log(`COGS (credits + fees + infra): $${report.new.totalCogs.toFixed(2)}`);
console.log(`  credit COGS: $${report.new.creditCogs.toFixed(2)}`);
console.log(`  payment fees: $${report.new.paymentFees.toFixed(2)}`);
console.log(`  infra: $${report.new.infra.toFixed(2)}`);

console.log("\n--- 6-month forecast ---");
for (const m of report.sixMonth.months) {
  console.log(
    `  Month ${m.month}: MRR $${m.mrr.toFixed(0)} | COGS $${m.cogs.toFixed(0)} | gross profit $${m.grossProfit.toFixed(0)} | paid subs ~${m.activePaid}`,
  );
}
console.log(`Cumulative revenue: $${report.sixMonth.cumulativeRevenue.toFixed(2)}`);
console.log(`Cumulative gross profit: $${report.sixMonth.cumulativeGrossProfit.toFixed(2)}`);
console.log(`6-month gross margin: ${report.sixMonth.grossMarginPct.toFixed(1)}%`);

console.log("\n--- Risk scenarios ---");
console.log(
  `If ALL signups max credits (stress test): ~${report.maxBurnRisk.allUsersMaxCreditsMarginPct.toFixed(1)}% gross margin`,
);
console.log(
  `Realistic blended (documented util): ${report.maxBurnRisk.realisticBlendedMarginPct.toFixed(1)}%`,
);

const warnings = [];
const blendedRounded = Math.round(report.newGrossMarginPct * 10) / 10;
if (blendedRounded < a.targetGrossMarginPercent) {
  warnings.push(`Blended gross margin ${blendedRounded.toFixed(1)}% below ${a.targetGrossMarginPercent}% target`);
}
for (const plan of ["starter", "pro", "infinity_i"]) {
  if (planMaxBurnMargin(plan, a) < 50) {
    warnings.push(`${plan} max-burn margin only ${planMaxBurnMargin(plan, a).toFixed(1)}% — subsidized if users max out`);
  }
}
const revAc = actionRevenueUsdPerCredit(a.planPriceUsd.starter, a.actionCreditsByPlan.starter);
if (actionCreditsFor5x(a.actionCostsUsd.androidBuild, revAc) > 50) {
  warnings.push("Android build 5x pricing may exceed user expectations — verify UI quotes");
}

if (warnings.length) {
  console.log("\n⚠ BREAK-EVEN / RISK WARNINGS:");
  warnings.forEach((w) => console.log(`  - ${w}`));
} else {
  console.log("\n✓ No break-even warnings at configured assumptions.");
}

if (blendedRounded < a.targetGrossMarginPercent) {
  process.exit(1);
}
