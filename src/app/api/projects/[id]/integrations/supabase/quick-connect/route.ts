import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyProjectOwner } from "@/lib/integrations/server/verify-project";
import { getUserProviderAccessToken } from "@/lib/integrations/server/user-provider-connections";
import { fetchSupabaseProjectApiKeys } from "@/lib/integrations/server/supabase-management-api";
import {
  saveProjectSecret,
  upsertProjectIntegration,
  writeConnectionAudit,
} from "@/lib/integrations/server/integration-store";
import { testSupabaseAnon, extractSupabaseRef } from "@/lib/integrations/server/supabase-api";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  projectRef: z.string().min(2),
});

/** POST — one-click Supabase project connect using linked account. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const verified = await verifyProjectOwner(projectId);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", verified.data.ownerId)
    .maybeSingle();

  if (!isPaidPlan(profile?.plan_id)) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "projectRef required" }, { status: 400 });
  }

  const mgmtToken = await getUserProviderAccessToken(verified.data.ownerId, "supabase");
  if (!mgmtToken) {
    return NextResponse.json({ needsLink: true }, { status: 409 });
  }

  const keys = await fetchSupabaseProjectApiKeys(mgmtToken, parsed.data.projectRef);
  if (!keys.ok) {
    return NextResponse.json({ error: keys.error }, { status: 400 });
  }

  const anonTest = await testSupabaseAnon(keys.url, keys.anonKey);
  if (!anonTest.ok) {
    return NextResponse.json({ error: anonTest.error }, { status: 400 });
  }

  const ref = extractSupabaseRef(keys.url);
  const now = new Date().toISOString();

  await saveProjectSecret({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "supabase",
    keyName: "SUPABASE_URL",
    value: keys.url,
  });
  await saveProjectSecret({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "supabase",
    keyName: "SUPABASE_ANON_KEY",
    value: keys.anonKey,
  });
  if (keys.serviceRoleKey) {
    await saveProjectSecret({
      projectId,
      ownerId: verified.data.ownerId,
      provider: "supabase",
      keyName: "SUPABASE_SERVICE_ROLE_KEY",
      value: keys.serviceRoleKey,
    });
  }

  await upsertProjectIntegration({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "supabase",
    status: "connected",
    displayName: ref ? `Supabase (${ref})` : "Supabase",
    metadata: { projectRef: parsed.data.projectRef, quickConnect: true },
    lastTestedAt: now,
  });

  await writeConnectionAudit({
    projectId,
    ownerId: verified.data.ownerId,
    provider: "supabase",
    action: "quick_connect",
    status: "ok",
    message: `Connected project ${parsed.data.projectRef}`,
  });

  return NextResponse.json({ ok: true, displayName: ref ? `Supabase (${ref})` : "Supabase" });
}
