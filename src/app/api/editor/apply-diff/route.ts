import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildFileDiffs } from "@/lib/editor/diff";
import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const body = await request.json();
  const authUser = guardExpensiveRoute(sessionUser, "diff", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId(body.projectId as string);
  if (isNextResponse(projectId)) return projectId;
  const patches = (body.patches as Array<{ path: string; content: string }>) ?? [];
  const validateAfterApply = body.validateAfterApply === true;
  if (patches.length === 0) {
    return NextResponse.json({ error: "patches required" }, { status: 400 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: owned } = await writer
    .from("projects")
    .select("id, owner_id, workspace_id")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!owned?.id) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: existing } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  const map: Record<string, string> = {};
  for (const f of existing ?? []) {
    if (f.path && f.content != null) map[f.path] = f.content;
  }

  const diffs = buildFileDiffs(patches, map);
  const rows = patches.map((p) => ({
    project_id: projectId,
    path: p.path,
    content: p.content,
    language: p.path.split(".").pop() ?? "text",
    mime_type: "text/plain",
    size_bytes: Buffer.byteLength(p.content, "utf8"),
  }));

  const { error } = await writer.from("app_files").upsert(rows as never, {
    onConflict: "project_id,path",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const { saveAppVersionSnapshot } = await import("@/lib/projects/app-version-history");
    await saveAppVersionSnapshot({
      admin: writer,
      projectId,
      ownerId: owned.owner_id,
      workspaceId: owned.workspace_id,
      createdBy: authUser.id,
      mode: "manual_edit",
      summary: `Manual edit — ${patches.length} file(s)`,
      files: patches.map((p) => ({ path: p.path, content: p.content })),
      changedPaths: patches.map((p) => p.path),
    });
  } catch {
    /* version history is best-effort */
  }

  const { data: allFiles } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  let validationOk = true;
  let validationReasons: string[] = [];
  if (validateAfterApply) {
    const merged = (allFiles ?? []).map((f) => ({
      path: f.path!,
      content: f.content ?? "",
    }));
    const v = validateGeneratedApp({
      files: merged,
      projectId,
      ownerId: authUser.id,
      routeMap: null,
    });
    validationOk = v.ok;
    validationReasons = v.reasons.slice(0, 5);
  }

  return NextResponse.json({
    ok: true,
    applied: patches.length,
    diffs,
    validationOk,
    validationReasons,
  });
}
