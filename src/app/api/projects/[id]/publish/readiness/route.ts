import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { scanAppSourceForReadiness } from "@/lib/publish/readiness-scan";
import { reconcileProjectBuildState } from "@/lib/build/reconcile-project-build";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { checkPublishReadiness } from "@/lib/publish/publish-readiness";
import {
  isBuildCompleteForProject,
  isZipImportProject,
  readImportMeta,
} from "@/lib/projects/imported-project-state";

export const dynamic = "force-dynamic";

export async function GET(
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
    .select("id, owner_id, name, metadata, preview_url, app_name, build_status, icon_svg")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient() ?? supabase;

  const buildReconcile = await reconcileProjectBuildState(admin, projectId, authUser.id);

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

  const isImport = isZipImportProject(meta);
  const importMeta = readImportMeta(meta);
  const filesCount = buildReconcile.fileCount;
  const buildStatus = buildReconcile.buildStatus ?? latestBuild?.status ?? null;
  const metaBuildStatus = typeof meta.build_status === "string" ? meta.build_status : null;
  const projectBuildStatus = project.build_status ?? null;
  const buildCompleted =
    buildReconcile.buildCompleted ||
    isBuildCompleteForProject({
      metadata: meta,
      fileCount: filesCount,
      buildJobStatus: latestBuild?.status,
      projectBuildStatus,
    }) ||
    buildStatus === "completed" ||
    buildStatus === "succeeded" ||
    metaBuildStatus === "completed" ||
    projectBuildStatus === "completed" ||
    projectBuildStatus === "imported";

  const metaAppName =
    typeof meta.app_name === "string"
      ? meta.app_name
      : typeof (meta.builder as Record<string, unknown> | undefined)?.app === "object"
        ? ((meta.builder as Record<string, unknown>).app as { name?: string })?.name
        : null;

  const appName = (project.app_name || metaAppName || importMeta.original_name || project.name || "").trim();
  const hasAppName = Boolean(appName && !/^new app$/i.test(appName) && !/^new build$/i.test(appName));

  const { data: previewErrs } = await admin
    .from("preview_errors")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);

  const hasPreviewErrors = (previewErrs?.length ?? 0) > 0;
  const hasPreview = Boolean(project.preview_url) || files?.some((f) => /preview/i.test(f.path));

  const fileRows = (files ?? []).map((f) => ({ path: f.path, content: f.content ?? "" }));
  const issues = scanAppSourceForReadiness(fileRows);

  const routeMap = Array.isArray(meta.blueprint_routes)
    ? (meta.blueprint_routes as string[])
    : null;

  const readiness = checkPublishReadiness({
    files: fileRows,
    projectId,
    ownerId: authUser.id,
    metadata: meta,
    routeMap,
  });

  const blockers = [...readiness.blockers];
  if (filesCount === 0 && buildCompleted) {
    blockers.unshift("Build saved no files — check build logs");
  }
  if (!buildCompleted && !isImport) blockers.push("Latest build has not completed successfully");
  if (!hasAppName && !isImport) blockers.push("App needs a generated name");
  if (isImport && (importMeta.env_requirements?.length ?? 0) > 0) {
    blockers.push("Missing environment variables — complete setup in Secrets");
  }
  if (hasPreviewErrors) blockers.push("Preview has compile errors — fix before publish");

  const canPublishWeb =
    readiness.ok &&
    filesCount > 0 &&
    buildCompleted &&
    hasAppName &&
    !hasPreviewErrors;

  const { data: published } = await admin
    .from("published_apps" as never)
    .select("subdomain, status, public_url, slug")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pubRow = published as {
    public_url?: string;
    subdomain?: string;
    status?: string;
    slug?: string;
  } | null;

  const publicUrl =
    pubRow?.status === "published"
      ? (pubRow.public_url ?? null)
      : readiness.publicUrl ??
        (typeof meta.public_url === "string" ? meta.public_url : null);

  return NextResponse.json({
    fileCount: filesCount,
    hasAppName,
    appName: hasAppName ? appName : null,
    buildStatus,
    latestBuildStatus: latestBuild?.status ?? null,
    buildCompleted,
    buildJobId: latestBuild?.id ?? null,
    lastBuildId: latestBuild?.id ?? null,
    lastBuildAt: latestBuild?.completed_at ?? null,
    hasPreview,
    hasPreviewErrors,
    previewErrors: hasPreviewErrors,
    canPublishWeb,
    artifactsReady: filesCount > 0 && buildCompleted,
    publishedUrl: pubRow?.public_url ?? null,
    publicUrl,
    subdomain: pubRow?.subdomain ?? pubRow?.slug ?? readiness.slug,
    slug: readiness.slug,
    issues,
    scannedAt: new Date().toISOString(),
    blockers: [...new Set(blockers)],
    reconciled: buildReconcile.reconciled,
    lifecycleStatus: typeof meta.lifecycle === "string" ? meta.lifecycle : null,
    validationOk: readiness.validationOk,
    uiQualityOk: readiness.uiQualityOk,
    uiQualityScore: readiness.uiQualityScore,
    previewReady: readiness.previewReady,
    secretsOk: readiness.secretsOk,
    routeRenderable: readiness.routeRenderable,
    canPublish: canPublishWeb,
  });
}
