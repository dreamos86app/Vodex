import { NextResponse } from "next/server";
import { verifyProjectOwner } from "@/lib/integrations/server/verify-project";
import { getUserProviderAccessToken } from "@/lib/integrations/server/user-provider-connections";
import { listSupabaseMgmtProjects } from "@/lib/integrations/server/supabase-management-api";
import { isPaidPlan } from "@/lib/billing/plan-features";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const token = await getUserProviderAccessToken(verified.data.ownerId, "supabase");
  if (!token) {
    return NextResponse.json({ linked: false, projects: [] });
  }

  const listed = await listSupabaseMgmtProjects(token);
  if (!listed.ok) {
    return NextResponse.json({ error: listed.error }, { status: 400 });
  }

  return NextResponse.json({
    linked: true,
    projects: listed.projects.map((p) => ({ ref: p.ref, name: p.name, region: p.region })),
  });
}
