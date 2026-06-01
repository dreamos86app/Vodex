import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { acceptWorkspaceInvitation, InviteError } from "@/lib/team/workspace-invitations";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const email = auth.user.email;
  if (!email) {
    return NextResponse.json({ error: "Account email required" }, { status: 400 });
  }

  try {
    const result = await acceptWorkspaceInvitation(
      adminWrap.admin,
      token,
      auth.user.id,
      email,
    );
    return NextResponse.json({
      ok: true,
      workspace_id: result.workspaceId,
      role: result.role,
    });
  } catch (e) {
    if (e instanceof InviteError) {
      const status =
        e.code === "not_found"
          ? 404
          : e.code === "wrong_email"
            ? 403
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Accept failed" },
      { status: 500 },
    );
  }
}
