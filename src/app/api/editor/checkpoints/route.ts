import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createCheckpoint, type EditorCheckpoint } from "@/lib/editor/checkpoints";
import {
  requireAuthUser,
  requireMutationProjectId,
  isNextResponse,
} from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const authUser = requireAuthUser(sessionUser);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId(new URL(request.url).searchParams.get("projectId"));
  if (isNextResponse(projectId)) return projectId;

  const writer = createServiceRoleClient() ?? supabase;
  const owned = await requireOwnedProject(writer, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const { data } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  const meta = (data?.metadata ?? {}) as { editor_checkpoints?: unknown[] };
  return NextResponse.json({ checkpoints: meta.editor_checkpoints ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: {
    projectId?: string;
    label?: string;
    stage?: "pre_build" | "pre_edit" | "pre_polish" | "pre_publish" | "post_stage" | "manual";
    files?: Array<{ path: string; content: string }>;
    changedPaths?: string[];
    userId?: string;
    user_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "diff", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId(body.projectId);
  if (isNextResponse(projectId)) return projectId;

  const label = (body.label as string) ?? "Checkpoint";
  const stage = (body.stage as EditorCheckpoint["stage"]) ?? "manual";
  const files = (body.files as Array<{ path: string; content: string }>) ?? [];
  const changedPaths = Array.isArray(body.changedPaths)
    ? (body.changedPaths as string[])
    : undefined;

  const cp = createCheckpoint({ projectId, label, stage, files, changedPaths });
  const writer = createServiceRoleClient() ?? supabase;

  const owned = await requireOwnedProject(writer, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const { data: proj } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();

  const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
  const list = Array.isArray(meta.editor_checkpoints) ? meta.editor_checkpoints : [];
  const next = [cp, ...list].slice(0, 20);
  await writer
    .from("projects")
    .update({ metadata: { ...meta, editor_checkpoints: next } as never })
    .eq("id", projectId)
    .eq("owner_id", authUser.id);

  return NextResponse.json({ checkpoint: cp });
}
