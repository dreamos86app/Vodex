import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import { reconcileProjectBuildState } from "@/lib/build/reconcile-project-build";

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, name, metadata, preview_url, app_name, build_status, icon_svg")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient() ?? supabase;

  const buildReconcile = await reconcileProjectBuildState(admin, projectId, user.id);
  const filesCount = buildReconcile.fileCount;

  const { data: files } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(500);

  const { data: latestBuild } = await admin
    .from("build_jobs")
    .select("id, status, completed_at, credits_charged, error_message")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const buildStatus = buildReconcile.buildStatus ?? latestBuild?.status ?? null;
  const metaBuildStatus = typeof meta.build_status === "string" ? meta.build_status : null;
  const projectBuildStatus = project.build_status ?? null;
  const buildCompleted =
    buildReconcile.buildCompleted ||
    buildStatus === "completed" ||
    buildStatus === "succeeded" ||
    metaBuildStatus === "completed" ||
    projectBuildStatus === "completed";

  const metaAppName =
    typeof meta.app_name === "string"
      ? meta.app_name
      : typeof (meta.builder as Record<string, unknown> | undefined)?.app === "object"
        ? ((meta.builder as Record<string, unknown>).app as { name?: string })?.name
        : null;

  const appName = (project.app_name || metaAppName || project.name || "").trim();
  const hasAppName = Boolean(appName && !/^new app$/i.test(appName) && !/^new build$/i.test(appName));

  const { data: previewErrs } = await admin
    .from("preview_errors")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);

  const hasPreviewErrors = (previewErrs?.length ?? 0) > 0;
  const hasPreview = Boolean(project.preview_url) || files?.some((f) => /preview/i.test(f.path));

  const issues = scanAppSourceForReadiness(
    (files ?? []).map((f) => ({ path: f.path, content: f.content ?? "" })),
  );

  const blockers: string[] = [];
  if (filesCount === 0) {
    blockers.push(
      buildCompleted
        ? "Build saved no files — check build logs"
        : "No generated app files yet",
    );
  }
  if (!buildCompleted) blockers.push("Latest build has not completed successfully");
  if (!hasAppName) blockers.push("App needs a generated name");
  if (hasPreviewErrors) blockers.push("Preview has compile errors — fix before publish");

  const canPublishWeb =
    filesCount > 0 && buildCompleted && hasAppName && !hasPreviewErrors;

  const { data: published } = await admin
    .from("publish_records")
    .select("published_url, subdomain, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    fileCount: filesCount,
    hasAppName,
    appName: hasAppName ? appName : null,
    buildStatus,
    buildCompleted,
    buildJobId: latestBuild?.id ?? null,
    hasPreview,
    hasPreviewErrors,
    canPublishWeb,
    artifactsReady: canPublishWeb,
    publishedUrl: published?.published_url ?? null,
    subdomain: published?.subdomain ?? null,
    issues,
    scannedAt: new Date().toISOString(),
    blockers,
    reconciled: buildReconcile.reconciled,
  });
}
