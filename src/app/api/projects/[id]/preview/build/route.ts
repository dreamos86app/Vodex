import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";
import { runProjectPreviewBuild } from "@/lib/imports/run-project-preview-build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const owned = await requireOwnedProject(supabase, projectId, user.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const { diagnostics, jobId } = await runProjectPreviewBuild({
    admin,
    writer: supabase,
    userId: user.id,
    projectId,
  });

  const queued = diagnostics.previewStatus === "queued";

  return NextResponse.json({
    ok: diagnostics.previewRenderable,
    queued,
    jobId,
    previewRenderable: diagnostics.previewRenderable,
    previewStatus: diagnostics.previewStatus,
    blockedReason: diagnostics.blockedReason,
    previewUrl: diagnostics.previewUrl,
    message: queued
      ? "Preview build queued for dedicated worker"
      : diagnostics.previewRenderable
        ? "Preview is ready"
        : diagnostics.blockedReason,
    diagnostics,
  });
}
