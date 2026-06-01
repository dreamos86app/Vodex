import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const docs = await read("src/lib/docs.ts");
  const tableMod = await read("src/lib/docs/plan-credits-doc-table.ts");
  const economics = await read("src/lib/billing/plan-credit-economics.ts");

  if (!docs.includes("PLAN_CREDITS_TABLE")) {
    errors.push("docs how-credits-work must inject PLAN_CREDITS_TABLE from canonical config");
  }
  if (!docs.includes("buildPlanCreditsMarkdownTable")) {
    errors.push("docs must import buildPlanCreditsMarkdownTable");
  }
  for (const id of [
    "infinity_i",
    "infinity_ii",
    "infinity_iii",
    "infinity_iv",
    "infinity_v",
    "infinity_vi",
    "infinity_vii",
  ]) {
    if (!tableMod.includes(id)) errors.push(`plan table missing ${id}`);
    if (!economics.includes(id)) errors.push(`plan economics missing ${id}`);
  }
  if (docs.includes("| Infinity | 1,000 | 2,500 |")) {
    errors.push("docs must not hardcode legacy single Infinity row");
  }

  if (errors.length) {
    console.error("verify:docs-plans FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:docs-plans OK");
}

main();
