#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/templates/previews");
fs.mkdirSync(outDir, { recursive: true });

const themes = {
  "ai-saas-starter": { bg: "#0f172a", accent: "#4d8dff", label: "AI SaaS" },
  "mobile-twa-play-store": { bg: "#042f2e", accent: "#14b8a6", label: "Mobile TWA" },
  "analytics-dashboard": { bg: "#0c1929", accent: "#06b6d4", label: "Analytics" },
  "marketplace-starter": { bg: "#1c1917", accent: "#f59e0b", label: "Marketplace" },
  "community-platform": { bg: "#1f0a14", accent: "#f43f5e", label: "Community" },
  "landing-waitlist": { bg: "#1e1b4b", accent: "#8b5cf6", label: "Landing" },
};

for (const [id, t] of Object.entries(themes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="${t.label} template preview">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${t.bg}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="${t.bg}"/>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect x="24" y="24" width="592" height="48" rx="12" fill="white" fill-opacity="0.08"/>
  <rect x="24" y="88" width="280" height="120" rx="14" fill="white" fill-opacity="0.1"/>
  <rect x="320" y="88" width="296" height="56" rx="10" fill="white" fill-opacity="0.08"/>
  <rect x="320" y="152" width="296" height="56" rx="10" fill="white" fill-opacity="0.06"/>
  <rect x="24" y="224" width="180" height="152" rx="12" fill="${t.accent}" fill-opacity="0.25"/>
  <rect x="220" y="224" width="180" height="152" rx="12" fill="white" fill-opacity="0.08"/>
  <rect x="416" y="224" width="200" height="152" rx="12" fill="white" fill-opacity="0.08"/>
  <text x="40" y="56" fill="white" font-family="system-ui,sans-serif" font-size="14" font-weight="600">${t.label}</text>
  <text x="40" y="118" fill="white" fill-opacity="0.9" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Vodex template</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `${id}.svg`), svg.trim());
  console.log("wrote", id);
}
