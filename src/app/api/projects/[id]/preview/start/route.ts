import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { startPreviewSession } from "@/lib/preview/preview-build-service";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const authUser = guardExpensiveRoute(sessionUser, "preview");
  if (isNextResponse(authUser)) return authUser;

  const writer = createServiceRoleClient() ?? supabase;
  const owned = await requireOwnedProject(writer, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const result = await startPreviewSession({ writer, userId: authUser.id, projectId });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        sessionId: result.sessionId ?? null,
      },
      { status: 400 },
    );
  }
  return NextResponse.json({
    sessionId: result.sessionId,
    previewUrl: result.previewUrl,
    status: result.status,
    providerLevel: result.providerLevel,
    externalUrl: result.externalUrl ?? null,
    lifecycleStatus: result.lifecycleStatus,
  });
}
