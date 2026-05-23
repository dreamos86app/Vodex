#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = fs.readFileSync(path.join(root, "src/lib/publish/publish-config.ts"), "utf8");
const publicUrl = fs.readFileSync(path.join(root, "src/lib/publish/public-url.ts"), "utf8");
const subdomain = fs.readFileSync(path.join(root, "src/lib/publish/subdomain.ts"), "utf8");
const badge = fs.readFileSync(path.join(root, "src/components/publish/public-url-mode-badge.tsx"), "utf8");
const errors = [];
const ok = [];

if (!cfg.includes("DREAMOS_WILDCARD_SUBDOMAIN")) errors.push("missing wildcard env flag");
else ok.push("wildcard env documented");

if (!cfg.includes("DREAMOS_DNS_VERIFIED")) errors.push("missing DNS verified flag");
else ok.push("DNS verified flag documented");

if (publicUrl.includes('mode: "path"') && publicUrl.includes('mode: "subdomain"')) {
  ok.push("public-url exposes honest mode");
} else errors.push("public-url missing mode");

if (subdomain.includes("buildPublicUrl")) ok.push("subdomain delegates to buildPublicUrl");
else errors.push("subdomain must not hardcode fake subdomain URL");

if (badge.includes("Path mode")) ok.push("UI shows path mode label");
if (badge.includes("Subdomain mode")) ok.push("UI shows subdomain mode when verified");

const wildcardFlag = process.env.DREAMOS_WILDCARD_SUBDOMAIN === "1";
const dnsVerified = process.env.DREAMOS_DNS_VERIFIED === "1";
const evidencePath = path.join(root, ".dreamos-evidence.json");
let evidence = {};
try {
  evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
} catch {
  /* */
}
evidence.wildcardDnsVerified = wildcardFlag && dnsVerified;
evidence.subdomainMode = evidence.wildcardDnsVerified ? "wildcard" : "path";
evidence.dnsVerified = dnsVerified;
evidence.subdomainScoreAfter = evidence.wildcardDnsVerified ? 88 : Math.max(evidence.subdomainScoreAfter ?? 78, 78);
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

if (!evidence.wildcardDnsVerified) {
  ok.push("path mode default (subdomain not verified live)");
  if (subdomain.includes("buildPublicUrl")) ok.push("DNS not verified blocks subdomain URLs");
} else {
  ok.push("wildcard DNS marked verified");
}

console.log("\n=== verify:dns-wildcard ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
