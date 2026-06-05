#!/usr/bin/env node
import { P43_CHECKS } from "./lib/p43-verify-checks.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P43_CHECKS["published-spa-routing"](root);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("✓ published SPA routing checks passed");
