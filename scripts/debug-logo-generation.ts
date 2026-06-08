#!/usr/bin/env npx tsx
/**
 * P1.3.16 — Logo generation diagnostics (env + provider wiring).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(name: string) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

import { isAiLogoGenerationAvailable } from "@/lib/projects/app-logo-generation";
import { isDreamOSMediaProviderDisabled } from "@/lib/media/dreamos-media-router";
import { isProviderSelectable } from "@/lib/ai/provider-availability";

function mask(key: string | undefined): string {
  if (!key?.trim()) return "(not set)";
  const t = key.trim();
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const providerDisabled = isDreamOSMediaProviderDisabled("logo");
  const openaiOk = isProviderSelectable("openai");
  let aiAvailable = false;
  let aiError: string | null = null;
  try {
    aiAvailable = isAiLogoGenerationAvailable();
  } catch (e) {
    aiError = e instanceof Error ? e.message : String(e);
  }

  console.log("=== Logo generation debug ===\n");
  console.log("OPENAI_API_KEY:", mask(openaiKey));
  console.log("OpenAI provider selectable:", openaiOk);
  console.log("DreamOS media logo disabled:", providerDisabled);
  console.log("isAiLogoGenerationAvailable():", aiAvailable);
  if (aiError) console.log("Availability check error:", aiError);
  console.log("\nIf logo fails at runtime, check:");
  console.log("- Action credits balance for logo generation");
  console.log("- project metadata app_identity.logo_generation_status");
  console.log("- server ops log for logo_generation events");
  console.log("- OPENAI_API_KEY must be set server-side (not project Secrets)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
