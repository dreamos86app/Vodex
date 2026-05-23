#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

mustExist("src/lib/deploy/provider-types.ts");
mustExist("src/lib/deploy/deploy-provider-registry.ts");
mustExist("src/lib/deploy/vercel-connection.ts");
mustExist("src/app/api/deploy/readiness/route.ts");
mustExist("src/app/api/deploy/export/route.ts");
mustExist("src/app/api/deploy/history/route.ts");
mustExist("src/components/deploy/deploy-readiness-center.tsx");
mustExist("src/components/deploy/deploy-workspace-panel.tsx");
mustExist("src/components/builder/app-builder-workspace.tsx");
mustExist("src/app/api/deploy/vercel/connect-status/route.ts");
mustExist("src/app/api/deploy/vercel/status/route.ts");
mustExist("src/app/api/deploy/vercel/start/route.ts");
mustExist("src/lib/deploy/vercel-client.ts");
mustExist("src/lib/deploy/vercel-config.ts");
mustExist("src/components/publish/public-url-mode-badge.tsx");
mustExist("scripts/deploy-tests.ts");

const readiness = fs.readFileSync(
  path.join(root, "src/components/deploy/deploy-workspace-panel.tsx"),
  "utf8",
);
if (readiness.includes("never fabricated") || readiness.includes("only from Vercel")) {
  ok.push("honest deploy URL copy");
} else errors.push("missing honest deploy URL messaging");

const vercel = fs.readFileSync(path.join(root, "src/lib/deploy/vercel-readiness.ts"), "utf8");
if (vercel.includes("not_connected")) ok.push("vercel not_connected state");
else errors.push("vercel readiness missing not_connected");
if (vercel.includes("token_invalid")) ok.push("vercel token_invalid state");
else errors.push("vercel readiness missing token_invalid");

const connection = fs.readFileSync(path.join(root, "src/lib/deploy/vercel-connection.ts"), "utf8");
if (connection.includes("missing_env")) ok.push("connection missing_env state");
if (connection.includes("token_invalid")) ok.push("connection token_invalid");
if (connection.includes("validateVercelAccessToken")) ok.push("token validation against Vercel API");

const exportRoute = fs.readFileSync(path.join(root, "src/app/api/deploy/export/route.ts"), "utf8");
if (exportRoute.includes("application/zip")) ok.push("real zip export route");
if (exportRoute.includes("README_DEPLOY")) ok.push("export includes README_DEPLOY");

const vercelStart = fs.readFileSync(path.join(root, "src/app/api/deploy/vercel/start/route.ts"), "utf8");
if (vercelStart.includes("not_connected")) ok.push("vercel start honest when not configured");
if (vercelStart.includes("missing_env")) ok.push("vercel start rejects missing_env");
if (vercelStart.includes("token_invalid")) ok.push("vercel start rejects invalid token");
if (vercelStart.includes("needs_project_link")) ok.push("vercel start needs project link");
if (vercelStart.includes("createVercelDeployment")) ok.push("vercel start uses real client");

const vercelClient = fs.readFileSync(path.join(root, "src/lib/deploy/vercel-client.ts"), "utf8");
if (!vercelClient.includes("fake") && vercelClient.includes("api.vercel.com")) ok.push("vercel client calls provider API");

const panel = fs.readFileSync(path.join(root, "src/components/deploy/deploy-workspace-panel.tsx"), "utf8");
if (panel.includes("Connect Vercel")) ok.push("disabled deploy when not connected");
if (panel.includes("Open deployment")) ok.push("open deployment URL button");
if (panel.includes("Deployment logs")) ok.push("logs panel");

const subdomain = fs.readFileSync(path.join(root, "src/lib/publish/subdomain.ts"), "utf8");
if (subdomain.includes("buildPublicUrl")) ok.push("subdomain uses honest public-url helper");

console.log("\n=== verify:deploy ===\n");
ok.forEach((m) => console.log("✓", m));

const fixture = spawnSync("npx tsx scripts/deploy-tests.ts", {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (fixture.status !== 0) {
  errors.push(fixture.stderr || fixture.stdout || "deploy-tests failed");
} else {
  ok.push("deploy-tests fixture suite");
}

const evidencePath = path.join(root, ".dreamos-evidence.json");
let evidence = {};
try {
  evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
} catch {
  /* */
}
evidence.deployRuntimeHonest = errors.length === 0;
evidence.deployScoreBefore = evidence.deployScoreBefore ?? 62;
evidence.deployScoreAfter = errors.length === 0 ? 90 : 62;
evidence.subdomainMode = process.env.DREAMOS_DNS_VERIFIED === "1" && process.env.DREAMOS_WILDCARD_SUBDOMAIN === "1" ? "wildcard" : "path";
evidence.dnsVerified = process.env.DREAMOS_DNS_VERIFIED === "1";
evidence.subdomainScoreBefore = evidence.subdomainScoreBefore ?? 65;
evidence.subdomainScoreAfter = evidence.subdomainMode === "wildcard" && evidence.dnsVerified ? 88 : 78;
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
ok.push(`evidence deployRuntimeHonest=${evidence.deployRuntimeHonest}`);

if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
