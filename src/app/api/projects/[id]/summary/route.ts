import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId, jsonNotFound, jsonUnauthorized } from "@/lib/ids/required-ids";
import { reconcileProjectLifecycle } from "@/lib/projects/reconcile-lifecycle";
import { LIFECYCLE_META } from "@/lib/projects/project-lifecycle";
import { resolveDisplayPublicUrl } from "@/lib/publish/publish-service";
import { wildcardSubdomainEnabled } from "@/lib/publish/publish-config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized();

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select(
      "id, name, slug, status, framework, preview_url, published_subdomain, build_status, metadata, description, updated_at, app_name, short_description, icon_url",
    )
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return jsonNotFound();

  const { lifecycle, fileCount, reconciled } = await reconcileProjectLifecycle(
    writer,
    projectId,
    user.id,
  );
  const meta = LIFECYCLE_META[lifecycle];

  const { count: jobCount } = await writer
    .from("build_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  return NextResponse.json({
    project,
    lifecycle_status: lifecycle,
    lifecycle: meta,
    fileCount,
    buildJobCount: jobCount ?? 0,
    reconciled,
    public_url: resolveDisplayPublicUrl(project),
    publish_mode: wildcardSubdomainEnabled() ? "subdomain" : "path",
    builder_url: `/apps/${projectId}/builder`,
    dashboard_url: `/apps/${projectId}/dashboard`,
  });
}
