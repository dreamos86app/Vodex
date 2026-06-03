import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { unsealSecret } from "@/lib/secrets/seal";
import { getIntegrationProvider } from "@/lib/generated-apps/integration-registry";
import { logSecurityAudit } from "@/lib/security/audit-events";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; provider: string }> },
) {
  const { id: projectId, provider: providerId } = await ctx.params;
  const def = getIntegrationProvider(providerId);
  if (!def) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

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

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { data: rows } = await admin
    .from("project_secrets")
    .select("key_name, ciphertext, encrypted_value")
    .eq("project_id", projectId);

  const required = def.fields.filter((f) => f.required).map((f) => f.key);
  const missing = required.filter((k) => !(rows ?? []).some((r) => r.key_name === k));
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Missing keys: ${missing.join(", ")}`, status: "incomplete" },
      { status: 400 },
    );
  }

  for (const row of rows ?? []) {
    const sealed = (row.ciphertext ?? row.encrypted_value) as string | null;
    if (!sealed) continue;
    try {
      unsealSecret(sealed);
    } catch {
      await admin
        .from("project_secrets")
        .update({ status: "invalid", last_tested_at: new Date().toISOString() } as never)
        .eq("project_id", projectId)
        .eq("key_name", row.key_name as string);
      return NextResponse.json({ ok: false, error: "Secret decryption failed" }, { status: 500 });
    }
  }

  await admin
    .from("project_secrets")
    .update({ status: "configured", last_tested_at: new Date().toISOString() } as never)
    .eq("project_id", projectId)
    .eq("provider", providerId);

  void logSecurityAudit({
    action: "integration_test",
    userId: user.id,
    projectId,
    metadata: { provider: providerId },
  });

  return NextResponse.json({ ok: true, status: "configured" });
}
