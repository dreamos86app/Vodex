import { NextResponse } from "next/server";
import { requireServiceAdmin } from "@/lib/team/api-auth";
import { getInvitationPreview } from "@/lib/team/workspace-invitations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const preview = await getInvitationPreview(adminWrap.admin, token);
  return NextResponse.json(preview);
}
