import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getDeployProviderStatuses } from "@/lib/deploy/deploy-provider-registry";
import { resolveVercelConnection } from "@/lib/deploy/vercel-connection";
import { checkPublishReadiness } from "@/lib/publish/publish-readiness";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const meta = (project.metadata as Record<string, unknown> | null) ?? {};
  const vercel = await resolveVercelConnection(meta, { validateToken: true });

  const admin = createServiceRoleClient() ?? supabase;
  const { data: files } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(500);

  const fileRows = (files ?? []).map((f) => ({ path: f.path, content: f.content ?? "" }));
  const publish = checkPublishReadiness({
    files: fileRows,
    projectId,
    ownerId: user.id,
    metadata: meta,
  });

  const providers = getDeployProviderStatuses({
    githubConnected: Boolean(meta.github_repo),
    vercel,
  });

  const checks = [
    {
      id: "vercel_token",
      title: "Vercel token",
      severity:
        vercel.state === "ready"
          ? "ok"
          : vercel.state === "token_invalid"
            ? "error"
            : "warning",
      detail: vercel.message,
    },
    {
      id: "vercel_project",
      title: "Vercel project link",
      severity: vercel.projectLinked ? "ok" : "error",
      detail: vercel.projectLinked
        ? "Project linked"
        : "Set VERCEL_PROJECT_ID or vercel_project_id in project metadata",
    },
    {
      id: "publish",
      title: "Publish readiness",
      severity: publish.ok ? "ok" : "error",
      detail: publish.ok ? "Snapshot ready for deploy" : publish.blockers[0] ?? "Not ready",
    },
    {
      id: "files",
      title: "App files",
      severity: fileRows.length > 0 ? "ok" : "error",
      detail: fileRows.length > 0 ? `${fileRows.length} files` : "Generate app files first",
    },
  ];

  const okCount = checks.filter((c) => c.severity === "ok").length;
  const readinessScore = Math.round((okCount / checks.length) * 100);

  return NextResponse.json({
    providers,
    vercel,
    publish,
    checks,
    readinessScore,
  });
}
