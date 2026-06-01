import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolvePrimaryWorkspaceId } from "@/lib/team/workspace-access";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import {
  createWorkspaceInvitation,
  assertCanManageMembers,
} from "@/lib/team/workspace-invitations";

type Body = { email?: string; role?: string; workspace_id?: string };

function mapInviteRole(r: string | undefined): "admin" | "editor" | "viewer" {
  if (r === "admin") return "admin";
  if (r === "viewer") return "viewer";
  return "editor";
}

/** Legacy path — forwards to workspace invitation flow. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const workspaceId =
    typeof body.workspace_id === "string" && body.workspace_id
      ? body.workspace_id
      : await resolvePrimaryWorkspaceId(supabase, user.id, user.email);

  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 400 });
  }

  const access = await getWorkspaceAccess(supabase, user.id, workspaceId);
  try {
    assertCanManageMembers(access);
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const result = await createWorkspaceInvitation(admin, {
      workspaceId,
      email,
      role: mapInviteRole(body.role === "member" ? "editor" : body.role),
      invitedBy: user.id,
      inviterName:
        inviterProfile?.display_name ??
        inviterProfile?.full_name ??
        user.email?.split("@")[0] ??
        "A teammate",
      inviterEmail: inviterProfile?.email ?? user.email ?? "",
      workspaceName: workspace?.name ?? "Vodex workspace",
    });

    return NextResponse.json({
      invite: {
        id: result.invite.id,
        email: result.invite.email,
        role: result.invite.role,
        status: "pending",
        created_at: result.invite.created_at,
      },
      email_sent: result.emailSent,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invite failed" },
      { status: 400 },
    );
  }
}
