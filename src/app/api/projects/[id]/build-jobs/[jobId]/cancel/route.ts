import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { persistBuildJobEvent } from "@/lib/build/build-job-events";
import { loadAllProjectAppFiles } from "@/lib/projects/load-all-app-files";
import { saveAppVersionSnapshot } from "@/lib/projects/app-version-history";

export const dynamic = "force-dynamic";

/** User-initiated stop — keep saved files, mark partial version, do not fail. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; jobId: string }> }) {
  const { id: projectId, jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;

  const { data: project } = await writer
    .from("projects")
    .select("id, owner_id, workspace_id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { data: job } = await writer
    .from("build_jobs")
    .select("id, status, prompt, meta")
    .eq("id", jobId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  const stoppable = ["running", "queued", "starting", "building"].includes(job.status ?? "");
  if (!stoppable) {
    return NextResponse.json({ ok: true, alreadyStopped: true });
  }

  await writer
    .from("build_jobs")
    .update({
      status: "cancelled",
      error_message: null,
      completed_at: new Date().toISOString(),
      meta: {
        ...(typeof job.meta === "object" && job.meta && !Array.isArray(job.meta) ? job.meta : {}),
        stopped_by_user: true,
        stop_reason: "user_stop",
      },
    } as never)
    .eq("id", jobId);

  await persistBuildJobEvent(writer, {
    jobId,
    projectId,
    userId: user.id,
    type: "partial_credit_stop",
    title: "Prompt stopped. Saved progress is kept.",
    detail: "Build cancelled by user — files already written are preserved.",
    progressPercent: 100,
    metadata: {
      stream_category: "assistant_message",
      user_stopped: true,
      version_status: "stopped_partial",
    },
  });

  const fileRows = await loadAllProjectAppFiles(writer, projectId);
  if (fileRows.length > 0) {
    const meta =
      project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
        ? (project.metadata as Record<string, unknown>)
        : {};
    const modelId =
      typeof meta.last_build_model === "string" ? meta.last_build_model : "automatic";
    await saveAppVersionSnapshot({
      admin: writer,
      projectId,
      ownerId: user.id,
      workspaceId: (project as { workspace_id?: string | null }).workspace_id ?? null,
      createdBy: user.id,
      mode: "build_stopped",
      summary: job.prompt?.slice(0, 120) ?? "Stopped build",
      files: fileRows,
      changedPaths: fileRows.map((f) => f.path),
    }).catch(() => null);

    await writer
      .from("projects")
      .update({
        build_status: "stopped_partial",
        metadata: {
          ...meta,
          live_version_status: "stopped_partial",
          last_build_model: modelId,
        },
      } as never)
      .eq("id", projectId);
  }

  return NextResponse.json({
    ok: true,
    message: "Prompt stopped. Saved progress is kept.",
    fileCount: fileRows.length,
  });
}
