import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { unpublishProject } from "@/lib/publish/publish-versioning";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";
import { logSecurityAudit } from "@/lib/security/audit-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const authUser = guardExpensiveRoute(sessionUser, "publish");
  if (isNextResponse(authUser)) return authUser;

  const writer = createServiceRoleClient() ?? supabase;
  const owned = await requireOwnedProject(writer, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const result = await unpublishProject({ writer, userId: authUser.id, projectId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logSecurityAudit({
    userId: authUser.id,
    action: "unpublish",
    projectId,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
