import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import { assertCanManageMembers } from "@/lib/team/workspace-invitations";

type PatchBody = { role?: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  const { workspaceId, memberId } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const access = await getWorkspaceAccess(auth.supabase, auth.user.id, workspaceId);
  try {
    assertCanManageMembers(access);
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role;
  if (!role || !["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: member } = await adminWrap.admin
    .from("workspace_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { data: ws } = await adminWrap.admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (ws?.owner_id === member.user_id) {
    return NextResponse.json({ error: "Cannot change workspace owner role" }, { status: 400 });
  }

  const { error } = await adminWrap.admin
    .from("workspace_members")
    .update({ role } as never)
    .eq("id", memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, role });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  const { workspaceId, memberId } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const access = await getWorkspaceAccess(auth.supabase, auth.user.id, workspaceId);
  try {
    assertCanManageMembers(access);
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: member } = await adminWrap.admin
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { data: ws } = await adminWrap.admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (ws?.owner_id === member.user_id) {
    const { count } = await adminWrap.admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner");

    const ownerViaWorkspace = ws.owner_id;
    const { data: owners } = await adminWrap.admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("role", ["owner"]);

    const ownerCount = Math.max(owners?.length ?? 0, ownerViaWorkspace ? 1 : 0);
    if (ownerCount <= 1 && (count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last workspace owner" },
        { status: 400 },
      );
    }
  }

  const { error } = await adminWrap.admin
    .from("workspace_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
