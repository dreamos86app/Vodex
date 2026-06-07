import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { isPreviewRepairEligible } from "@/lib/build/preview-deterministic-repair";
import {
  mapLegacyPreviewErrorCode,
  isPreviewFailureCode,
  type PreviewFailureCode,
} from "@/lib/preview/preview-failure-codes";
import { computeProjectCardStatus } from "@/lib/projects/project-card-status";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { repairBuildStateTruth } from "@/lib/build/build-state-truth-repair";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const reader = createServiceRoleClient() ?? supabase;
  const { data: project } = await reader
    .from("projects")
    .select("id, build_status, metadata, preview_url, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  const lifecycle = readLifecycleFromMetadata(project.metadata);

  const { count: appFileCount } = await reader
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (
    (appFileCount ?? 0) >= MIN_RENDERABLE_FILES &&
    (project.build_status === "failed" || project.build_status === "needs_repair")
  ) {
    await repairBuildStateTruth(reader, projectId, user.id, {
      startPreview: true,
      apply: true,
    });
    const { data: refreshed } = await reader
      .from("projects")
      .select("id, build_status, metadata, preview_url, owner_id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (refreshed) Object.assign(project, refreshed);
  }

  const { data: files } = await reader
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);
  const renderable = filterRenderableBuildFiles(
    (files ?? []).map((f) => ({ path: f.path, content: f.content ?? "" })),
  );
  const integrity = evaluateSourceIntegrity(renderable);
  const hasRoot = renderable.some((f) => /^app\/page\.(tsx|jsx)$/i.test(f.path));

  const rawCode = meta.preview_error_code as string | undefined;
  const lastErrorCode: PreviewFailureCode = isPreviewFailureCode(rawCode ?? "")
    ? (rawCode as PreviewFailureCode)
    : mapLegacyPreviewErrorCode(rawCode);
  const previewFailed =
    project.build_status === "preview_failed" || Boolean(meta.files_ready_preview_failed);
  const previewRenderable = integrity.previewRenderable && !previewFailed;

  const cardStatus = computeProjectCardStatus({
    build_status: project.build_status,
    metadata: meta,
    previewIntegrity: {
      previewRenderable: integrity.previewRenderable,
      sourceIntegrityOk: integrity.sourceIntegrityOk,
      hasRootPage: hasRoot,
    },
  });

  return NextResponse.json({
    ok: true,
    build_status: project.build_status,
    preview_state: previewRenderable ? "renderable" : previewFailed ? "failed" : "preparing",
    source_integrity_ok: integrity.sourceIntegrityOk,
    last_error_code: lastErrorCode,
    last_error_message:
      (meta.preview_error as string | undefined) ??
      integrity.blockedReason ??
      null,
    can_retry: previewFailed || !previewRenderable,
    can_repair: isPreviewRepairEligible(lastErrorCode),
    card_status: cardStatus,
    lifecycle_status: lifecycle.lifecycle_status,
  });
}
