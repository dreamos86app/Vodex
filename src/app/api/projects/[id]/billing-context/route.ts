import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertProjectAccess } from "@/lib/projects/project-access";
import {
  resolveCreditBillingTarget,
  billingSourceLabel,
} from "@/lib/billing/workspace-credit-billing";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const access = await assertProjectAccess(writer, user.id, projectId);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = await resolveCreditBillingTarget(writer, {
    actorUserId: user.id,
    projectId,
    workspaceId: access.workspaceId,
  });

  return NextResponse.json({
    project_id: projectId,
    actor_user_id: user.id,
    billed_user_id: target.billedUserId,
    billed_to_type: target.billedToType,
    billing_mode: target.billingMode,
    label: billingSourceLabel(target),
    workspace_id: target.workspaceId,
  });
}
