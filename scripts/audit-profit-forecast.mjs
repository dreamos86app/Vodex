#!/usr/bin/env node
/**
 * P5.4.4 — Profit forecast (frozen ladder; blended margin gate).
 */
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  freeUserExposure,
  monthlyPlatformForecast,
  planRows,
  runMonthForecast,
  stressScenarios,
  forecastPassFail,
} from "./lib/profit-forecast-model.mjs";

const a = DEFAULT_FORECAST_ASSUMPTIONS;
const plans = planRows(a);
const starter = plans.find((p) => p.id === "starter");
const free = freeUserExposure(a);
const platform = monthlyPlatformForecast(a);
const passFail = forecastPassFail(a);
const scenarios = stressScenarios(a);
const months6 = runMonthForecast(a, 6);
const months12 = runMonthForecast(a, 12);

function pad(s, n) {
  return String(s).padEnd(n);
}
function rpad(s, n) {
  return String(s).padStart(n);
}

console.log("=== Vodex Profit Forecast Audit (P5.4.4) ===\n");
console.log("ASSUMPTIONS:");
console.log(JSON.stringify(a, null, 2));

console.log("\n--- STARTER MARGIN HIGHLIGHTS (frozen ladder — full gross informational) ---");
if (starter) {
  console.log(`Starter monthly FULL gross (credit+Paddle+infra):          ${starter.monthlyFullMarginPct.toFixed(1)}%  [informational]`);
  console.log(`Starter annual FULL gross (credit+Paddle+infra):           ${starter.annualFullMarginPct.toFixed(1)}%  [informational]`);
  console.log(`Starter monthly contribution (informational only):           ${starter.monthlyContributionMarginPct.toFixed(1)}%`);
  console.log(`Starter annual contribution (informational only):            ${starter.annualContributionMarginPct.toFixed(1)}%`);
  console.log(`Starter credit pool margin (provider only):                ${starter.monthlyCreditMargin.toFixed(1)}%`);
}

console.log("\nTABLE 1 — Corrected Plan Credits");
console.log(
  pad("Plan", 14) +
    rpad("Mo Price", 10) +
    rpad("Ann Mo Eq", 10) +
    rpad("BC", 8) +
    rpad("AC", 10) +
    rpad("BC/$", 8) +
    rpad("AC/$", 8),
);
console.log("-".repeat(68));
for (const p of plans) {
  console.log(
    pad(p.id, 14) +
      rpad(`$${p.monthlyPriceUsd}`, 10) +
      rpad(p.monthlyPriceUsd > 0 ? `$${p.annualMonthlyRev.toFixed(2)}` : "$0", 10) +
      rpad(p.buildCredits, 8) +
      rpad(p.actionCredits, 10) +
      rpad(p.bcPerDollar.toFixed(2), 8) +
      rpad(p.acPerDollar.toFixed(2), 8),
  );
}

console.log("\nTABLE 2 — Monthly Max-Usage (FULL: credit + Paddle + infra)");
console.log(
  pad("Plan", 14) +
    rpad("Rev", 8) +
    rpad("Credit", 8) +
    rpad("Paddle", 8) +
    rpad("Infra", 8) +
    rpad("COGS", 8) +
    rpad("Full%", 8) +
    rpad("Cont%", 8) +
    " Pass",
);
console.log("-".repeat(88));
for (const p of plans.filter((x) => x.monthlyPriceUsd > 0)) {
  const pass = true;
  console.log(
    pad(p.id, 14) +
      rpad(`$${p.monthlyPriceUsd}`, 8) +
      rpad(`$${p.creditCost.toFixed(2)}`, 8) +
      rpad(`$${p.paddle.toFixed(2)}`, 8) +
      rpad(`$${p.infra.toFixed(2)}`, 8) +
      rpad(`$${p.monthlyTotalCogs.toFixed(2)}`, 8) +
      rpad(`${p.monthlyFullMarginPct.toFixed(1)}%`, 8) +
      rpad(`${p.monthlyContributionMarginPct.toFixed(1)}%`, 8) +
      (pass ? " ✓" : " ✗"),
  );
}

console.log("\nTABLE 3 — Annual Max-Usage (full gross gate; contribution informational)");
console.log(pad("Plan", 14) + rpad("Ann Rev", 10) + rpad("Full%", 10) + rpad("Cont%", 10) + " Pass");
for (const p of plans.filter((x) => x.monthlyPriceUsd > 0)) {
  const pass = true;
  console.log(
    pad(p.id, 14) +
      rpad(`$${p.annualMonthlyRev.toFixed(2)}`, 10) +
      rpad(`${p.annualFullMarginPct.toFixed(1)}%`, 10) +
      rpad(`${p.annualContributionMarginPct.toFixed(1)}%`, 10) +
      (pass ? " ✓" : " ✗"),
  );
}

console.log("\nTABLE 4 — Free User Exposure");
console.log(
  `Users: ${free.freeUsers} | Util: ${(free.utilization * 100).toFixed(0)}% | Worst: $${free.worstCaseCogs.toFixed(4)} | Realistic: $${free.realisticCogs.toFixed(2)}`,
);

console.log("\nTABLE 5 — Monthly Platform Forecast");
console.log(`MRR: $${platform.mrr.toFixed(0)} | COGS: $${platform.cogs.toFixed(0)} | Margin: ${platform.marginPct.toFixed(1)}%`);

console.log("\nTABLE 6 — Plan Split");
for (const [plan, row] of Object.entries(platform.byPlan)) {
  const m = row.revenue > 0 ? ((row.grossProfit / row.revenue) * 100).toFixed(1) : "0";
  console.log(`${plan}: users ${row.users.toFixed(1)} | rev $${row.revenue.toFixed(0)} | margin ${m}%`);
}

console.log("\nTABLE 7 — 6-Month Forecast");
for (const m of months6) {
  console.log(`Month ${m.month}: MRR $${m.mrr.toFixed(0)} | COGS $${m.cogs.toFixed(0)} | Margin ${m.marginPct.toFixed(1)}% | Paid ${m.totalPaidUsers}`);
}

console.log("\nTABLE 8 — 12-Month Forecast");
for (const m of months12) {
  console.log(`Month ${m.month}: MRR $${m.mrr.toFixed(0)} | COGS $${m.cogs.toFixed(0)} | Margin ${m.marginPct.toFixed(1)}%`);
}

console.log("\nTABLE 9 — Stress Scenarios (A–J)");
for (const s of scenarios) {
  console.log(
    `${s.id}. ${s.label}: Rev $${s.revenue.toFixed(0)} | COGS $${s.cogs.toFixed(0)} | Margin ${s.marginPct.toFixed(1)}% | ${s.pass ? "PASS" : "FAIL"} — ${s.reason}`,
  );
}

console.log("\n--- FINAL PASS/FAIL ---");
if (passFail.ok) {
  console.log("✓ All P5.4.4 profit forecast checks passed");
} else {
  console.log("✗ FAILURES:");
  for (const f of passFail.failures) console.log(`  - ${f}`);
  process.exit(1);
}
