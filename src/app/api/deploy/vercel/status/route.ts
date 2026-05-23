import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVercelServerConfig } from "@/lib/deploy/vercel-config";
import { getVercelDeployment, getVercelDeploymentEvents } from "@/lib/deploy/vercel-client";
import { resolveVercelConnection } from "@/lib/deploy/vercel-connection";

type DeploymentRow = {
  id: string;
  status: string;
  deployment_url: string | null;
  provider_deployment_id: string | null;
  logs: unknown;
  metadata: unknown;
};

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
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = (project.metadata as Record<string, unknown> | null) ?? {};
  const connection = await resolveVercelConnection(meta, { validateToken: false });

  const { data: rawRow } = await supabase
    .from("project_deployments" as never)
    .select("*")
    .eq("project_id" as never, projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = rawRow as DeploymentRow | null;

  if (!row) {
    return NextResponse.json({
      status: connection.state === "ready" ? "not_deployed" : connection.state,
      deploymentUrl: null,
      logs: [],
      connection,
    });
  }

  const cfg = getVercelServerConfig(meta);
  let deploymentUrl: string | null = null;
  let status = row.status;
  let logs: unknown[] = Array.isArray(row.logs) ? (row.logs as unknown[]) : [];
  let providerDeploymentId = row.provider_deployment_id;
  const rowMeta = (row.metadata as Record<string, unknown> | null) ?? {};
  let errorMessage = typeof rowMeta.error === "string" ? rowMeta.error : null;

  if (row.provider_deployment_id && cfg.hasToken && connection.state === "ready") {
    try {
      const dep = await getVercelDeployment(cfg, row.provider_deployment_id);
      providerDeploymentId = dep.id;
      const vercelState = dep.readyState ?? dep.state ?? "";
      if (vercelState === "READY" && dep.url) {
        status = "ready";
        deploymentUrl = `https://${dep.url}`;
      } else if (vercelState === "ERROR" || vercelState === "CANCELED") {
        status = "failed";
        deploymentUrl = null;
        errorMessage = "Vercel deployment failed";
      } else {
        status = "building";
        deploymentUrl = null;
      }

      const events = await getVercelDeploymentEvents(cfg, row.provider_deployment_id);
      if (events.length > 0) logs = events;

      await supabase
        .from("project_deployments" as never)
        .update({
          status,
          deployment_url: deploymentUrl,
          logs,
          metadata: { ...rowMeta, error: errorMessage },
        } as never)
        .eq("id" as never, row.id);
    } catch {
      /* keep stored row */
    }
  } else if (row.status === "ready" && row.deployment_url) {
    deploymentUrl = row.deployment_url;
  }

  return NextResponse.json({
    status,
    deploymentUrl,
    providerDeploymentId,
    logs,
    errorMessage,
    connection,
  });
}
