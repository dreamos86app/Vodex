#!/usr/bin/env node
/**
 * P5.4.4 — Margin optimization audit (frozen ladder; provider + consumption tuning).
 */
import { p544Summary } from "./lib/p544-margin-model.mjs";

const s = p544Summary();

function pad(v, n) {
  return String(v).padEnd(n);
}
function rpad(v, n) {
  return String(v).padStart(n);
}

console.log("=== Vodex P5.4.4 Margin Optimization Audit ===\n");
console.log(`Frozen ladder: Starter ${s.starter.buildCredits} BC / ${s.starter.actionCredits} AC`);
console.log(`Starter full-gross max-burn (informational): ${s.starterFullGrossMaxBurnPct.toFixed(1)}%`);
console.log(`Blended platform margin (forecast): ${s.blendedPlatformMarginPct.toFixed(1)}%`);
console.log(`Blended unit-economics margin: ${s.unitEconomicsBlendedPct.toFixed(1)}%\n`);

console.log("TABLE 1 — Action audit (current → optimized)");
console.log(
  pad("Action", 28) +
    rpad("Cost", 8) +
    rpad("Prov$", 8) +
    rpad("CurCr", 7) +
    rpad("CurM%", 8) +
    rpad("NewCr", 7) +
    rpad("NewM%", 8),
);
console.log("-".repeat(74));
for (const row of s.actionTable.filter((r) => r.currentCredits !== r.suggestedCredits || r.savingsPerUse > 0.001)) {
  console.log(
    pad(row.action, 28) +
      rpad(`$${row.currentCost.toFixed(3)}`, 8) +
      rpad(`$${row.providerCost.toFixed(3)}`, 8) +
      rpad(row.currentCredits, 7) +
      rpad(`${row.currentMargin.toFixed(1)}%`, 8) +
      rpad(row.suggestedCredits, 7) +
      rpad(`${row.newMargin.toFixed(1)}%`, 8),
  );
}

console.log("\nTABLE 2 — Provider optimizations (top savings)");
for (const row of s.providerSavings.slice(0, 15)) {
  console.log(
    `${pad(row.action, 28)} prov $${row.providerBefore.toFixed(3)}→$${row.providerAfter.toFixed(3)} (${row.pctProviderSave.toFixed(0)}%)  credits ${row.creditsBefore}→${row.creditsAfter}`,
  );
}

console.log("\nTABLE 3 — Platform simulations");
for (const [label, sim] of [
  ["1,000 paid", s.simulations.sim1k],
  ["5,000 paid", s.simulations.sim5k],
  ["10,000 paid", s.simulations.sim10k],
  ["25,000 paid", s.simulations.sim25k],
]) {
  console.log(`\n${label}`);
  console.log(
    `  Revenue: $${sim.mrr.toFixed(0)} | Current COGS: $${sim.current.cogs.toFixed(0)} | Margin: ${sim.current.margin.toFixed(1)}%`,
  );
  console.log(
    `  Optimized COGS: $${sim.optimized.cogs.toFixed(0)} | Margin: ${sim.optimized.margin.toFixed(1)}% | Δ profit/mo: $${sim.delta.grossProfit.toFixed(0)}`,
  );
}

console.log("\n--- PROJECTED IMPROVEMENT ---");
console.log(`Monthly profit uplift @ 1k paid: $${s.monthlyProfitDelta1k.toFixed(0)}`);
console.log(`Annual profit uplift @ 1k paid:  $${s.annualProfitDelta1k.toFixed(0)}`);
console.log(`Margin uplift @ 5k paid:         +${s.simulations.sim5k.delta.marginPts.toFixed(2)} pts`);
console.log("\n✓ P5.4.4 margin optimization audit complete");
