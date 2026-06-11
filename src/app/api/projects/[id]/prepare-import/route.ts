import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reconcileProjectBuildStateServer } from "@/lib/build/reconcile-project-build-server";
import { isZipImportProject, readImportMeta, preferredEntryFile } from "@/lib/projects/imported-project-state";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { runProjectPreviewBuild } from "@/lib/imports/run-project-preview-build";
import {
  estimateZipPreviewCreditsWithPlatformMultiplier,
  reserveZipPreviewActionCredits,
} from "@/lib/imports/zip-preview-action-credits";
import { loadZipPreviewHoldStatus } from "@/lib/imports/zip-preview-billing";

export const dynamic = "force-dynamic";

/** Normalize imported ZIP app and queue honest preview build — no fake preview_ready. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUser = requireAuthUser(user);
  if (isNextResponse(authUser)) return authUser;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, app_name, metadata, build_status")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  if (!isZipImportProject(meta) && meta.source !== "zip_import") {
    return NextResponse.json({ error: "Only imported apps can be prepared this way" }, { status: 400 });
  }

  const admin = createServiceRoleClient() ?? supabase;

  const { data: fileRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(500);

  const files = (fileRows ?? []).map((f) => ({ path: f.path, content: f.content ?? "" }));
  if (files.length === 0) {
    return NextResponse.json({ error: "No imported files found" }, { status: 400 });
  }

  const paths = files.map((f) => f.path);
  const entry = preferredEntryFile(paths) ?? paths.find((p) => /\.html?$/i.test(p)) ?? paths[0];
  const imp = readImportMeta(meta);

  const nextMeta = {
    ...meta,
    source: "zip_import",
    lifecycle_status: "imported",
    preview_ready: false,
    preview_honest: false,
    preview_renderable: false,
    preview_status: "queued",
    file_count: files.length,
    import: {
      ...imp,
      preview_ready: false,
      entry_file: entry,
      prepared_at: new Date().toISOString(),
    },
  };

  await admin
    .from("projects")
    .update({
      build_status: "imported",
      metadata: nextMeta,
    } as never)
    .eq("id", projectId)
    .eq("owner_id", authUser.id);

  await reconcileProjectBuildStateServer(admin, projectId, authUser.id);

  const hold = await loadZipPreviewHoldStatus(projectId);
  let creditEstimate: Awaited<ReturnType<typeof estimateZipPreviewCreditsWithPlatformMultiplier>> | undefined;
  if (!hold || hold.status !== "reserved") {
    const totalBytes = files.reduce((sum, f) => sum + Buffer.byteLength(f.content, "utf8"), 0);
    creditEstimate = await estimateZipPreviewCreditsWithPlatformMultiplier({
      sizeBytes: totalBytes,
      fileCount: files.length,
      frameworkId: String(meta.framework ?? "vite"),
      dependencyCount: 0,
    });
    await reserveZipPreviewActionCredits({
      userId: authUser.id,
      projectId,
      estimate: creditEstimate,
    });
  }

  const build = await runProjectPreviewBuild({
    admin,
    writer: admin,
    userId: authUser.id,
    projectId,
    creditEstimate,
  });

  return NextResponse.json({
    ok: true,
    fileCount: files.length,
    entryFile: entry,
    previewReady: false,
    previewBuild: build,
  });
}
