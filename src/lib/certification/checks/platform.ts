import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CertificationCheck } from "@/lib/certification/types";

/** Platform-level certification (Vodex infra) — separate from per-app. */
export async function runPlatformCertificationChecks(): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  checks.push({
    id: "platform_supabase",
    section: "platform",
    title: "Supabase configuration",
    status: supabaseUrl && anon ? "passed" : "blocker",
    weight: 8,
    detail: supabaseUrl && anon ? "Public Supabase env present." : "Missing Supabase URL or anon key.",
  });

  checks.push({
    id: "platform_service_role",
    section: "platform",
    title: "Service role (server)",
    status: service ? "passed" : "blocker",
    weight: 8,
    detail: service ? "Service role configured server-side." : "SUPABASE_SERVICE_ROLE_KEY missing.",
  });

  checks.push({
    id: "platform_app_url",
    section: "platform",
    title: "App URL",
    status: appUrl ? "passed" : "warning",
    weight: 4,
    detail: appUrl ?? "NEXT_PUBLIC_APP_URL not set.",
  });

  const seal = process.env.APP_SECRET_ENCRYPTION_KEY ?? process.env.DREAMOS_SECRETS_MASTER_KEY;
  checks.push({
    id: "platform_secrets_seal",
    section: "platform",
    title: "Secret encryption",
    status: seal ? "passed" : "blocker",
    weight: 7,
    detail: seal ? "Master encryption key configured." : "APP_SECRET_ENCRYPTION_KEY missing.",
  });

  const admin = createServiceRoleClient();
  if (admin) {
    const { error } = await admin.from("projects").select("id").limit(1);
    checks.push({
      id: "platform_db",
      section: "platform",
      title: "Database connectivity",
      status: error ? "blocker" : "passed",
      weight: 8,
      detail: error ? error.message : "Projects table reachable.",
    });
  }

  return checks;
}
