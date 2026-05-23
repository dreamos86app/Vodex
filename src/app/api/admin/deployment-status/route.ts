import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { getAppUrl } from "@/lib/app-url";
import { safeFetch } from "@/lib/network/safe-fetch";
import { checkBuilderSchemaHealth } from "@/lib/builder/schema-health";
import { checkOnboardingSchemaHealth } from "@/lib/onboarding/schema-health";
import { RUNTIME_MIGRATION_FILE, RUNTIME_SQL_FALLBACK } from "@/lib/schema/runtime-required-schema";
import { DREAMOS_SUPABASE_PROJECT_REF } from "@/lib/supabase/project-ref";

const EXPECTED_SUPABASE_REF = DREAMOS_SUPABASE_PROJECT_REF;

const ENV_CHECKS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
] as const;

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? getAppUrl();

  const envPresent: Record<string, boolean> = {};
  for (const name of ENV_CHECKS) {
    envPresent[name] = Boolean(process.env[name]?.trim());
  }

  const serviceRoleOk =
    envPresent.SUPABASE_SERVICE_ROLE_KEY || envPresent.SUPABASE_SECRET_KEY;
  const llmOk =
    envPresent.OPENAI_API_KEY ||
    envPresent.ANTHROPIC_API_KEY ||
    envPresent.GOOGLE_GENERATIVE_AI_API_KEY ||
    envPresent.GEMINI_API_KEY;

  let termsReachable = false;
  let privacyReachable = false;
  let contactReachable = false;
  const base = appUrl.replace(/\/$/, "");
  const [terms, privacy, contact] = await Promise.all([
    safeFetch(`${base}/terms`, { method: "GET", redirect: "follow" }, "deployment_status_terms"),
    safeFetch(`${base}/privacy`, { method: "GET", redirect: "follow" }, "deployment_status_privacy"),
    safeFetch(`${base}/contact`, { method: "GET", redirect: "follow" }, "deployment_status_contact"),
  ]);
  termsReachable = terms.response?.ok ?? false;
  privacyReachable = privacy.response?.ok ?? false;
  contactReachable = contact.response?.ok ?? false;

  const [builderSchema, onboardingSchema] = await Promise.all([
    checkBuilderSchemaHealth().catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : "builder_schema_check_failed",
    })),
    checkOnboardingSchemaHealth().catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : "onboarding_schema_check_failed",
    })),
  ]);

  const authCallbackOk =
    appUrl.includes("dreamos86.com") || /localhost|127\.0\.0\.1/i.test(appUrl);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    appUrl,
    productionDomain: "https://dreamos86.com",
    schema: {
      migration_file: RUNTIME_MIGRATION_FILE,
      sql_fallback: RUNTIME_SQL_FALLBACK,
      builder: builderSchema,
      onboarding: onboardingSchema,
    },
    auth: {
      expectedProductionCallback: "https://dreamos86.com/auth/callback",
      appUrlLooksConfigured: authCallbackOk,
      googleOAuthNote:
        "Google may still show *.supabase.co until Supabase Custom Auth Domain is enabled and added to Google OAuth redirect URIs.",
    },
    supabase: {
      expectedRef: EXPECTED_SUPABASE_REF,
      refMatch: supabaseUrl.includes(EXPECTED_SUPABASE_REF),
      urlConfigured: Boolean(supabaseUrl),
    },
    env: {
      present: envPresent,
      serviceRoleOk,
      llmOk,
      appUrlIsProduction:
        appUrl.includes("dreamos86.com") && !/localhost|127\.0\.0\.1/i.test(appUrl),
    },
    legal: {
      termsReachable,
      privacyReachable,
      contactReachable,
    },
    packages: {
      speedInsightsInstalled: true,
    },
    reminders: [
      "Vercel deploys code only — run Supabase migrations separately.",
      "After migrations: NOTIFY pgrst, 'reload schema';",
      "After env var changes in Vercel: redeploy Production.",
    ],
  });
}
