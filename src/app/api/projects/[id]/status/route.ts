import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  canTransition,
  isLifecycleStatus,
  lifecyclePatch,
  legacyProjectStatus,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import {
  requireAuthUser,
  requireMutationProjectId,
  isNextResponse,
} from "@/lib/ids/api-mutation-guard";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";
import { logSecurityAudit } from "@/lib/security/audit-events";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  let body: { status?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nextStatus = body.status?.trim();
  if (!nextStatus || !isLifecycleStatus(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid lifecycle status", code: "invalid_status" },
      { status: 400 },
    );
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select("id, metadata, owner_id")
    .eq("id", projectId)
    .eq("owner_id", auth.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta = readLifecycleFromMetadata(project.metadata);
  const current: ProjectLifecycleStatus = meta.lifecycle_status ?? "draft";

  if (!canTransition(current, nextStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${current} to ${nextStatus}`,
        code: "invalid_transition",
        from: current,
        to: nextStatus,
      },
      { status: 400 },
    );
  }

  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  await writer
    .from("projects")
    .update({
      status: legacyProjectStatus(nextStatus),
      metadata: {
        ...prevMeta,
        ...lifecyclePatch(nextStatus, {
          status_change_reason: body.reason?.slice(0, 500) ?? null,
          status_changed_by: auth.id,
        }),
      },
    } as never)
    .eq("id", projectId)
    .eq("owner_id", auth.id);

  await logSecurityAudit({
    userId: auth.id,
    action: "lifecycle_override",
    projectId,
    metadata: { from: current, to: nextStatus, reason: body.reason ?? null },
    request,
  });

  return NextResponse.json({ ok: true, lifecycle_status: nextStatus, from: current });
}
