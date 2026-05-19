import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { getAppUrl } from "@/lib/app-url";

const EXPECTED_SUPABASE_REF = "xycqutvqxtkbszytaxbe";

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
  try {
    const base = appUrl.replace(/\/$/, "");
    const [termsRes, privacyRes] = await Promise.all([
      fetch(`${base}/terms`, { method: "GET", redirect: "follow" }),
      fetch(`${base}/privacy`, { method: "GET", redirect: "follow" }),
    ]);
    termsReachable = termsRes.ok;
    privacyReachable = privacyRes.ok;
  } catch {
    /* unreachable from this runtime */
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    appUrl,
    productionDomain: "https://dreamos86.com",
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
