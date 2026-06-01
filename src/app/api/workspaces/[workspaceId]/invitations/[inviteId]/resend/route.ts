import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import { resendWorkspaceInvitation, assertCanManageMembers } from "@/lib/team/workspace-invitations";

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

  const { data: workspace } = await adminWrap.admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: inviterProfile } = await adminWrap.admin
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", auth.user.id)
    .maybeSingle();

  try {
    const result = await resendWorkspaceInvitation(adminWrap.admin, {
      workspaceId,
      inviteId,
      workspaceName: workspace?.name ?? "Vodex workspace",
      inviterName:
        inviterProfile?.display_name ??
        inviterProfile?.full_name ??
        auth.user.email?.split("@")[0] ??
        "A teammate",
      inviterEmail: inviterProfile?.email ?? auth.user.email ?? "",
    });
    return NextResponse.json({ email_sent: result.emailSent });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Resend failed" },
      { status: 400 },
    );
  }
}
