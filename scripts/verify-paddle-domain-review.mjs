/**
 * Paddle domain review readiness — legal, pricing, brand.
 * Run: npm run verify:paddle-domain-review
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = {
  refund: "src/components/marketing/legal/refund-content.tsx",
  terms: "src/components/marketing/legal/terms-content.tsx",
  pricing: "src/components/pricing/pricing-view.tsx",
  brandConfig: "src/lib/brand/brand-config.ts",
  enterpriseSheet: "docs/paddle-enterprise-pricing-sheet.md",
  footer: "src/components/marketing/public-marketing-shell.tsx",
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  console.log("\n=== verify:paddle-domain-review ===\n");

  const refund = await read(files.refund);
  const terms = await read(files.terms);
  const pricing = await read(files.pricing);
  const sheet = await read(files.enterpriseSheet);

  if (!/14\s*days|14-day/i.test(refund)) fail("refund policy must state 14-day window");
  else ok("refund policy contains 14-day window");

  if (!/Paddle/i.test(refund)) fail("refund policy must reference Paddle");
  else ok("refund policy references Paddle");

  if (!/merchant of record/i.test(refund)) fail("refund policy must mention merchant of record");
  else ok("refund policy mentions merchant of record");

  if (!/SUPPORT_EMAIL/.test(refund) || !/support@vodex\.dev/.test(refund + (await read(files.brandConfig)))) {
    fail("refund policy must use support@vodex.dev");
  } else ok("refund policy support email");

  if (!/LEGAL_COMPANY_NAME/.test(terms) || !/Vodex Labs/.test(await read(files.brandConfig))) {
    fail("terms must reference Vodex Labs");
  } else ok("terms reference Vodex Labs");

  if (!/merchant of record/i.test(terms) || !/Paddle/i.test(terms)) {
    fail("terms must reference Paddle as merchant of record");
  } else ok("terms reference Paddle MoR");

  if (!/PUBLISHED_APP_EXAMPLE_HOST/.test(terms)) {
    fail("terms subdomain example must use PUBLISHED_APP_EXAMPLE_HOST (your-app.vodex.dev)");
  } else ok("terms use vodex.dev subdomain example via brand config");

  if (/dreamos86\.com/i.test(terms + refund + pricing)) {
    fail("legal/pricing must not contain dreamos86.com");
  } else ok("no dreamos86.com in legal/pricing components");

  if (!/\$1,500/.test(pricing) || !/Enterprise\s*\/\s*Custom/i.test(pricing)) {
    fail("pricing page must show Enterprise section with $1,500+ starting price");
  } else ok("pricing enterprise range visible ($1,500+)");

  if (!/self-serve software platform/i.test(pricing)) {
    fail("pricing must disclose human-services (self-serve)");
  } else ok("human-services disclosure on pricing");

  if (!/support@vodex\.dev/.test(pricing)) fail("pricing must show support@vodex.dev");
  else ok("pricing support email");

  if (!/\$1,500/.test(sheet) || !/\$10,000/.test(sheet) || !/Vodex Labs/.test(sheet)) {
    fail("enterprise pricing sheet must show $1,500–$10,000+ range");
  } else ok("enterprise pricing sheet present ($1,500+)");

  const brand = await read(files.brandConfig);
  if (!/vodex\.dev/.test(brand) || !/APP_URL/.test(brand)) {
    fail("brand-config must canonicalize vodex.dev");
  } else ok("brand-config canonical domain");

  if (process.exitCode) {
    console.error("\nverify:paddle-domain-review FAILED\n");
    process.exit(1);
  }
  console.log("\nverify:paddle-domain-review — all checks passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
