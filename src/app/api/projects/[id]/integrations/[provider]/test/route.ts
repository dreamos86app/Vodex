import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runIntegrationProviderTest } from "@/lib/integrations/integration-test-harness";
import { logSecurityAudit } from "@/lib/security/audit-events";

export const dynamic = "force-dynamic";

const ALIASES: Record<string, string> = {
  lemonsqueezy: "lemon_squeezy",
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; provider: string }> },
) {
  const { id: projectId, provider: rawProvider } = await ctx.params;
  const provider = ALIASES[rawProvider] ?? rawProvider;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let forceMock = false;
  try {
    const body = (await req.json()) as { forceMock?: boolean; mode?: string };
    forceMock = body.forceMock === true || body.mode === "mock";
  } catch {
    forceMock = false;
  }

  const result = await runIntegrationProviderTest({
    projectId,
    ownerId: user.id,
    provider,
    forceMock,
  });

  void logSecurityAudit({
    action: "integration_test",
    userId: user.id,
    projectId,
    metadata: { provider, mode: result.mode, label: result.label, ok: result.ok },
  });

  return NextResponse.json({
    ok: result.ok,
    mode: result.mode,
    label: result.label,
    testStatus: result.testStatus,
    message: result.message,
    connectionHealth: result.connectionHealth,
    webhookStatus: result.webhookStatus,
  });
}
