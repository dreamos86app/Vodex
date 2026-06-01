import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import { createWorkspaceInvitation, assertCanManageMembers } from "@/lib/team/workspace-invitations";

type Body = { email?: string; role?: string };

function mapRole(r: string | undefined): "admin" | "editor" | "viewer" {
  if (r === "admin") return "admin";
  if (r === "viewer") return "viewer";
  return "editor";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
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

  const inviterName =
    inviterProfile?.display_name ??
    inviterProfile?.full_name ??
    auth.user.email?.split("@")[0] ??
    "A teammate";
  const inviterEmail = inviterProfile?.email ?? auth.user.email ?? "";

  try {
    const result = await createWorkspaceInvitation(adminWrap.admin, {
      workspaceId,
      email,
      role: mapRole(body.role),
      invitedBy: auth.user.id,
      inviterName,
      inviterEmail,
      workspaceName: workspace?.name ?? "Vodex workspace",
    });

    return NextResponse.json({
      invite: result.invite,
      email_sent: result.emailSent,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invite failed" },
      { status: 400 },
    );
  }
}
