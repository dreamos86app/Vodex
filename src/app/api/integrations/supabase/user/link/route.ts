import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionUser } from "@/lib/auth/session";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { createClient } from "@/lib/supabase/server";
import { saveUserProviderConnection } from "@/lib/integrations/server/user-provider-connections";
import { listSupabaseMgmtProjects } from "@/lib/integrations/server/supabase-management-api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  accessToken: z.string().min(20),
});

/**
 * Link Supabase account via Management API personal access token.
 * User creates token at https://supabase.com/dashboard/account/tokens
 */
export async function POST(req: Request) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("plan_id").eq("id", user.id).maybeSingle();
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
    return NextResponse.json({ error: "Valid access token required" }, { status: 400 });
  }

  const token = parsed.data.accessToken.trim();
  const listed = await listSupabaseMgmtProjects(token);
  if (!listed.ok) {
    return NextResponse.json({ error: listed.error }, { status: 400 });
  }

  await saveUserProviderConnection({
    userId: user.id,
    provider: "supabase",
    accessToken: token,
    displayName: `${listed.projects.length} project(s)`,
    metadata: { projectCount: listed.projects.length },
  });

  return NextResponse.json({
    ok: true,
    projectCount: listed.projects.length,
    projects: listed.projects.map((p) => ({
      ref: p.ref,
      name: p.name,
      region: p.region,
    })),
  });
}
