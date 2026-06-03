import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { loadLatestPreviewDiagnostics } from "@/lib/imports/runtime-build-runner";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("metadata, preview_url")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const admin = createSupabaseAdmin();
  const jobDiagnostics = admin ? await loadLatestPreviewDiagnostics(admin, projectId) : null;

  let jobRow: {
    id: string;
    status: string;
    created_at: string;
    artifact_path: string | null;
    source_snapshot_path: string | null;
    locked_by: string | null;
  } | null = null;

  if (admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_build_jobs")
      .select("id, status, created_at, artifact_path, source_snapshot_path, locked_by")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobRow = data ?? null;
  }

  const jobStatus = jobRow?.status ?? null;
  const queuedAt = jobRow?.created_at ? new Date(jobRow.created_at).getTime() : 0;
  const workerUnavailable =
    jobStatus === "queued" && queuedAt > 0 && Date.now() - queuedAt > 5 * 60 * 1000;
  const diag =
    jobDiagnostics ??
    (meta.preview_diagnostics && typeof meta.preview_diagnostics === "object"
      ? (meta.preview_diagnostics as Record<string, unknown>)
      : null);

  const importMeta =
    meta.import && typeof meta.import === "object"
      ? (meta.import as Record<string, unknown>)
      : null;

  return NextResponse.json({
    previewRenderable: Boolean(meta.preview_renderable ?? diag?.previewRenderable),
    previewStatus: String(diag?.previewStatus ?? meta.preview_status ?? "unknown"),
    blockedReason: (diag?.blockedReason as string | null) ?? meta.preview_blocked_reason ?? null,
    previewUrl: project.preview_url ?? (diag?.previewUrl as string | null) ?? null,
    diagnostics: diag,
    framework: meta.imported_framework ?? diag?.framework ?? null,
    frameworkLabel:
      (diag?.frameworkLabel as string | undefined) ??
      (importMeta?.framework &&
      typeof importMeta.framework === "object" &&
      typeof (importMeta.framework as { label?: string }).label === "string"
        ? (importMeta.framework as { label: string }).label
        : null),
    entryFile:
      (Array.isArray(diag?.entryFiles) && diag.entryFiles[0]
        ? String(diag.entryFiles[0])
        : null) ??
      (typeof importMeta?.entry_file === "string" ? importMeta.entry_file : null),
    legacyPlatform:
      (diag?.legacyPlatform as string | null) ??
      (typeof meta.legacy_platform === "string" ? meta.legacy_platform : null),
    warnings: Array.isArray(diag?.warnings) ? diag.warnings.map(String) : [],
    buildLogs: typeof diag?.buildLogs === "string" ? diag.buildLogs : null,
    lastPreviewBuildAt:
      (typeof diag?.lastPreviewBuildAt === "string" ? diag.lastPreviewBuildAt : null) ??
      (typeof meta.last_preview_build_at === "string" ? meta.last_preview_build_at : null),
    jobId: jobRow?.id ?? (diag?.jobId as string | null) ?? null,
    jobStatus,
    artifactPath: jobRow?.artifact_path ?? (diag?.artifactPath as string | null) ?? null,
    sourceSnapshotPath: jobRow?.source_snapshot_path ?? null,
    lockedBy: jobRow?.locked_by ?? null,
    workerUnavailable,
    workerUnavailableMessage: workerUnavailable
      ? "Preview worker has not picked up this job — start npm run preview-worker:dev or deploy the worker service."
      : null,
  });
}
