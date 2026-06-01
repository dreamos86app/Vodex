import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import { revokeWorkspaceInvitation, assertCanManageMembers } from "@/lib/team/workspace-invitations";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const { workspaceId, inviteId } = await params;
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

  try {
    await revokeWorkspaceInvitation(adminWrap.admin, workspaceId, inviteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Revoke failed" },
      { status: 400 },
    );
  }
}
