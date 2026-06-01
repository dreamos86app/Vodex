#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const pkg = read("package.json");

const checks = [
  ["root error uses RouteErrorPage", () => {
    const f = read("src/app/error.tsx");
    if (!f.includes("RouteErrorPage")) throw new Error("missing RouteErrorPage");
    if (!f.includes('boundary="root"')) throw new Error("missing root boundary");
  }],
  ["workspace error boundary", () => {
    if (!fs.existsSync(path.join(root, "src/app/(workspace)/error.tsx"))) {
      throw new Error("workspace error.tsx missing");
    }
    const f = read("src/app/(workspace)/error.tsx");
    if (!f.includes('boundary="workspace"')) throw new Error("workspace boundary tag");
    if (!f.includes("RouteErrorOwnerDiagnostics") && !f.includes("RouteErrorPage")) {
      throw new Error("must use shared error page");
    }
  }],
  ["RouteErrorOwnerDiagnostics inline", () => {
    const f = read("src/components/dev/route-error-owner-diagnostics.tsx");
    if (!f.includes("Copy full fix prompt")) throw new Error("copy fix prompt");
    if (!f.includes("/api/account/identity")) throw new Error("identity fetch");
    if (!f.includes("buildRouteErrorFixPrompt")) throw new Error("fix prompt builder");
    if (!f.includes("Copy crash report")) throw new Error("sanitized fallback");
    if (!f.includes("data-testid=\"copy-full-fix-prompt\"")) throw new Error("testid");
  }],
  ["route error context persistence", () => {
    const f = read("src/lib/dev/route-error-context.ts");
    if (!f.includes("persistRouteErrorPayload")) throw new Error("persist");
    if (!f.includes("conversationId")) throw new Error("conversationId capture");
    if (!f.includes("autostart")) throw new Error("autostart capture");
  }],
  ["global error diagnostics", () => {
    const f = read("src/app/global-error.tsx");
    if (!f.includes("GlobalErrorDiagnostics")) throw new Error("global diagnostics");
  }],
  ["npm script", () => {
    if (!pkg.includes('"verify:error-boundary-diagnostics"')) throw new Error("npm script");
  }],
];

let failed = 0;
for (const [label, fn] of checks) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}:`, e instanceof Error ? e.message : e);
  }
}
process.exit(failed ? 1 : 0);
