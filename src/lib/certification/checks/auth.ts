import "server-only";

import { buildPublishedAuthDiagnostics } from "@/lib/publish/published-auth-diagnostics";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

export async function runAuthCertificationChecks(
  ctx: CertificationContext,
): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];
  const admin = createServiceRoleClient();

  const { data: authRow } = admin
    ? await admin
        .from("app_auth_provider_settings" as never)
        .select("*")
        .eq("project_id", ctx.projectId)
        .maybeSingle()
    : { data: null };

  const settings = (authRow ?? {}) as Record<string, unknown>;
  const diagnostics = await buildPublishedAuthDiagnostics({
    projectId: ctx.projectId,
    slug: ctx.publishedSlug,
    publicUrl: ctx.publishedUrl,
    authSettings: settings,
  });

  const googleOn = settings.google_enabled === true;
  const emailOn = settings.email_password_enabled !== false;
  const anyProvider = googleOn || settings.github_enabled === true || emailOn;

  if (!anyProvider) {
    checks.push({
      id: "auth_no_providers",
      section: "auth",
      title: "Sign-in methods",
      status: ctx.published ? "warning" : "passed",
      weight: 6,
      detail: "No auth providers enabled.",
      fix: "Enable Google or email/password in Dashboard → Authentication.",
    });
  }

  if (googleOn) {
    checks.push({
      id: "auth_google_enabled",
      section: "auth",
      title: "Google provider",
      status: "passed",
      weight: 5,
      detail: "Google enabled in app auth settings.",
    });
  }

  const centralOk = diagnostics.checks.find((c) => c.id === "central_callback");
  checks.push({
    id: "auth_central_callback",
    section: "auth",
    title: "OAuth callback configuration",
    status:
      centralOk?.status === "error"
        ? "blocker"
        : centralOk?.status === "warn"
          ? "warning"
          : "passed",
    weight: 10,
    detail: centralOk?.detail ?? "Central callback configured.",
    fix:
      centralOk?.status !== "ok"
        ? "Add https://vodex.dev/auth/callback to Supabase redirect URLs."
        : undefined,
  });

  if (diagnostics.lastAuthError) {
    checks.push({
      id: "auth_last_error",
      section: "auth",
      title: "Last auth error",
      status: "blocker",
      weight: 9,
      detail: diagnostics.lastAuthError,
      fix: "Fix auth configuration and test sign-in in incognito.",
    });
  } else if (ctx.published && googleOn) {
    checks.push({
      id: "auth_live_test",
      section: "auth",
      title: "Live Google login",
      status: "warning",
      weight: 8,
      detail: "Config looks valid — manual incognito Google login not verified by automation.",
      fix: "Test /p/{slug}/login with Google in incognito after deploy.",
    });
  }

  if (!diagnostics.supabaseAnonKeyDetected || !diagnostics.supabaseUrl) {
    checks.push({
      id: "auth_supabase_env",
      section: "auth",
      title: "Platform Supabase configuration",
      status: "blocker",
      weight: 10,
      detail: "Platform Supabase URL or anon key missing.",
      fix: "Configure NEXT_PUBLIC_SUPABASE_URL and anon key on deployment.",
    });
  } else {
    checks.push({
      id: "auth_supabase_env",
      section: "auth",
      title: "Platform Supabase configuration",
      status: "passed",
      weight: 10,
      detail: "Supabase env detected for published auth.",
    });
  }

  return checks;
}
