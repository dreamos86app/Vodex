import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getPendingDiff,
  savePendingDiff,
  updatePendingDiffStatus,
} from "@/lib/editor/pending-diff-store";
import type { FileDiff } from "@/lib/editor/diff";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";

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
  const { data: owned } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const pending = await getPendingDiff(writer, authUser.id, projectId);
  return NextResponse.json({ pending });
}

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
  const summary = (body.summary as string) ?? "Pending changes";
  const diffs = (body.diffs as FileDiff[]) ?? [];
  const generationId = (body.generationId as string) ?? `pending:${Date.now()}`;

  if (diffs.length === 0) {
    return NextResponse.json({ error: "diffs required" }, { status: 400 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: owned } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const record = await savePendingDiff(writer, {
    userId: authUser.id,
    projectId,
    conversationId: body.conversationId,
    summary,
    diffs,
    generationId,
    quoteId: body.quoteId,
    checkpointId: body.checkpointId,
  });

  return NextResponse.json({ pending: record });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const body = await request.json();
  const authUser = guardExpensiveRoute(sessionUser, "diff", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const { projectId, diffId, status, remainingDiffs } = body as {
    projectId?: string;
    diffId?: string;
    status?: "applied" | "rejected" | "failed" | "pending";
    remainingDiffs?: FileDiff[];
  };

  const pid = requireMutationProjectId(projectId);
  if (isNextResponse(pid)) return pid;
  if (!diffId) {
    return NextResponse.json({ error: "projectId and diffId required" }, { status: 400 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: owned } = await writer
    .from("projects")
    .select("id")
    .eq("id", pid)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (remainingDiffs && Array.isArray(remainingDiffs)) {
    const { updatePendingDiffFiles } = await import("@/lib/editor/pending-diff-store");
    await updatePendingDiffFiles(writer, authUser.id, pid, diffId, remainingDiffs);
    return NextResponse.json({ ok: true, remaining: remainingDiffs.length });
  }

  if (!status || status === "pending") {
    return NextResponse.json({ error: "status or remainingDiffs required" }, { status: 400 });
  }

  await updatePendingDiffStatus(writer, authUser.id, pid, diffId, status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const projectIdRaw = new URL(request.url).searchParams.get("projectId");
  const diffId = new URL(request.url).searchParams.get("diffId");
  const projectId = requireMutationProjectId(projectIdRaw);
  if (isNextResponse(projectId)) return projectId;
  if (!diffId) {
    return NextResponse.json({ error: "projectId and diffId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const authUser = requireAuthUser(sessionUser);
  if (isNextResponse(authUser)) return authUser;

  const writer = createServiceRoleClient() ?? supabase;
  const { data: owned } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await updatePendingDiffStatus(writer, authUser.id, projectId, diffId, "rejected");
  return NextResponse.json({ ok: true });
}
