import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

const PROVIDERS = [
  "github",
  "supabase",
  "stripe",
  "paypal",
  "paddle",
  "lemon_squeezy",
  "revenuecat",
  "resend",
  "firebase",
  "openai",
  "anthropic",
  "gemini",
] as const;

export async function runIntegrationCertificationChecks(
  ctx: CertificationContext,
): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];
  const admin = createServiceRoleClient();
  if (!admin) {
    checks.push({
      id: "integrations_admin",
      section: "integrations",
      title: "Integration scan",
      status: "warning",
      weight: 5,
      detail: "Service role unavailable — integration health not fully verified.",
    });
    return checks;
  }

  const { data: rows } = await admin
    .from("app_integration_connections" as never)
    .select("provider, mode, status, last_test_status, connection_health, webhook_status, last_error")
    .eq("project_id", ctx.projectId);

  const byProvider = new Map(
    (rows ?? []).map((r) => [String((r as { provider: string }).provider), r as Record<string, unknown>]),
  );

  let connectedCount = 0;
  for (const provider of PROVIDERS) {
    const row = byProvider.get(provider);
    const mode = row?.mode ? String(row.mode) : "disconnected";
    const status = row?.status ? String(row.status) : "disconnected";

    if (status === "connected" || mode.startsWith("connected")) connectedCount += 1;

    if (!row) continue;

    const label =
      mode === "connected_mock"
        ? "mock"
        : mode === "connected_sandbox"
          ? "sandbox"
          : mode === "connected_live"
            ? "live"
            : mode;

    const testOk = row.last_test_status === "live_ok" || row.last_test_status === "sandbox_ok" || row.last_test_status === "mock_ok";
    checks.push({
      id: `integration_${provider}`,
      section: "integrations",
      title: `${provider} (${label})`,
      status:
        row.last_error && !testOk
          ? "warning"
          : testOk
            ? "passed"
            : status === "connected"
              ? "warning"
              : "passed",
      weight: 3,
      detail: row.last_error
        ? String(row.last_error)
        : testOk
          ? `Last test: ${String(row.last_test_status)} — health ${String(row.connection_health ?? "unknown")}`
          : `Mode: ${label}. Run Test connection in Integrations.`,
      fix: !testOk ? `Open Integrations → ${provider} → Test connection.` : undefined,
    });
  }

  if (connectedCount === 0) {
    checks.push({
      id: "integrations_none",
      section: "integrations",
      title: "Connected integrations",
      status: "warning",
      weight: 4,
      detail: "No integrations connected yet. Mock/sandbox tests available without live accounts.",
      fix: "Connect GitHub or Supabase for launch; use mock mode to verify harness.",
    });
  } else {
    checks.push({
      id: "integrations_summary",
      section: "integrations",
      title: "Connected integrations",
      status: "passed",
      weight: 4,
      detail: `${connectedCount} provider(s) with connection records.`,
    });
  }

  return checks;
}
