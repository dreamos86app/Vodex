import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const access = await getWorkspaceAccess(auth.supabase, auth.user.id, workspaceId);
  if (!access) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { data: wm } = await auth.supabase
    .from("workspace_members")
    .select("id, user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  const userIds = [...new Set((wm ?? []).map((r) => r.user_id))];
  const profileById = new Map<
    string,
    { email: string | null; display_name: string | null; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profs } = await adminWrap.admin
      .from("profiles")
      .select("id, email, full_name, display_name, avatar_url")
      .in("id", userIds);
    for (const p of profs ?? []) {
      profileById.set(p.id, {
        email: p.email,
        display_name: p.display_name ?? p.full_name,
        avatar_url: p.avatar_url,
      });
    }
  }

  const { data: ownerRow } = await adminWrap.admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const members = (wm ?? []).map((row) => {
    const p = profileById.get(row.user_id);
    const isOwner = ownerRow?.owner_id === row.user_id;
    return {
      id: row.id,
      user_id: row.user_id,
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: isOwner ? "owner" : row.role,
      is_you: row.user_id === auth.user.id,
    };
  });

  const { data: invites } = await auth.supabase
    .from("workspace_invitations")
    .select("id, email, role, expires_at, created_at, accepted_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const pending = (invites ?? []).filter((i) => new Date(i.expires_at) > new Date());

  return NextResponse.json({ members, invitations: pending });
}
