import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createVercelDeployment } from "@/lib/deploy/vercel-client";
import { resolveVercelConnection } from "@/lib/deploy/vercel-connection";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";
import { checkPublishReadiness } from "@/lib/publish/publish-readiness";
import { logSecurityAudit } from "@/lib/security/audit-events";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: { projectId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "deploy", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId(body.projectId);
  if (isNextResponse(projectId)) return projectId;

  const writer = createServiceRoleClient() ?? supabase;
  const owned = await requireOwnedProject(writer, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const { data: project } = await writer
    .from("projects")
    .select("id, name, metadata")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const meta = (project.metadata as Record<string, unknown> | null) ?? {};
  const connection = await resolveVercelConnection(meta, { validateToken: true });

  if (connection.state === "not_connected") {
    return NextResponse.json(
      { status: "not_connected", message: connection.message },
      { status: 503 },
    );
  }
  if (connection.state === "missing_env") {
    return NextResponse.json(
      { status: "missing_env", message: connection.message, missingEnv: connection.missingEnv },
      { status: 503 },
    );
  }
  if (connection.state === "token_invalid") {
    return NextResponse.json(
      { status: "token_invalid", message: connection.message },
      { status: 503 },
    );
  }
  if (connection.state === "needs_project_link") {
    return NextResponse.json(
      { status: "needs_project_link", message: connection.message },
      { status: 503 },
    );
  }

  const { data: files } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  const fileRows = (files ?? [])
    .filter((f) => f.path && f.content != null)
    .map((f) => ({ path: f.path!, content: f.content! }));

  if (fileRows.length === 0) {
    return NextResponse.json({ error: "No generated files to deploy" }, { status: 400 });
  }

  const readiness = checkPublishReadiness({
    files: fileRows,
    projectId,
    ownerId: authUser.id,
    metadata: meta,
  });

  if (!readiness.secretsOk) {
    return NextResponse.json(
      { error: "Secrets detected in app files — remove before deploy", code: "secrets_blocked" },
      { status: 403 },
    );
  }
  if (!readiness.validationOk) {
    return NextResponse.json(
      {
        error: readiness.blockers[0] ?? "App failed validation — fix before deploy",
        code: "deploy_not_ready",
        blockers: readiness.blockers.slice(0, 5),
      },
      { status: 403 },
    );
  }

  const { data: deploymentRow, error: insertErr } = await writer
    .from("project_deployments" as never)
    .insert({
      project_id: projectId,
      user_id: authUser.id,
      provider: "vercel",
      status: "building",
      deployment_url: null,
      provider_deployment_id: null,
      logs: [],
      metadata: {},
    } as never)
    .select("id")
    .single();

  const rowId = (deploymentRow as { id: string } | null)?.id;
  if (insertErr || !rowId) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not create deployment" }, { status: 500 });
  }

  try {
    const deployResult = await createVercelDeployment({
      name: project.name ?? "dreamos-app",
      files: fileRows,
      projectMeta: meta,
    });

    if (!deployResult.ok) {
      const message = deployResult.error;
      await writer
        .from("project_deployments" as never)
        .update({
          status: "failed",
          metadata: { error: message, code: deployResult.code },
          logs: [{ at: new Date().toISOString(), level: "error", message }],
        } as never)
        .eq("id" as never, rowId);

      return NextResponse.json({ status: deployResult.code, message }, { status: 502 });
    }

    const deploymentUrl =
      deployResult.url && deployResult.state === "READY" ? `https://${deployResult.url}` : null;
    const status = deploymentUrl ? "ready" : "building";

    await writer
      .from("project_deployments" as never)
      .update({
        provider_deployment_id: deployResult.deploymentId,
        status,
        deployment_url: deploymentUrl,
        logs: [{ at: new Date().toISOString(), event: "created", id: deployResult.deploymentId }],
      } as never)
      .eq("id" as never, rowId);

    await writer
      .from("projects")
      .update({
        metadata: {
          ...meta,
          last_vercel_deployment_id: deployResult.deploymentId,
          ...(deploymentUrl ? { last_deployment_url: deploymentUrl } : {}),
        },
      })
      .eq("id", projectId)
      .eq("owner_id", authUser.id);

    await logSecurityAudit({
      userId: authUser.id,
      action: "deploy",
      projectId,
      metadata: {
        providerDeploymentId: deployResult.deploymentId,
        deploymentUrl,
        status,
      },
      request,
    });

    return NextResponse.json({
      status,
      deploymentUrl,
      providerDeploymentId: deployResult.deploymentId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deploy failed";
    await writer
      .from("project_deployments" as never)
      .update({
        status: "failed",
        metadata: { error: message },
        logs: [{ at: new Date().toISOString(), level: "error", message }],
      } as never)
      .eq("id" as never, rowId);

    return NextResponse.json({ status: "failed", message }, { status: 502 });
  }
}

/** Retry deploy — same guarded POST. */
export async function PUT(request: Request) {
  return POST(request);
}
