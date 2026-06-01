import { NextResponse } from "next/server";
import { requireApiUser, requireServiceAdmin } from "@/lib/team/api-auth";
import { getWorkspaceAccess } from "@/lib/team/workspace-access";
import type { WorkspaceBillingMode } from "@/lib/billing/workspace-credit-billing";

const MODES: WorkspaceBillingMode[] = [
  "personal_credits",
  "workspace_sponsored",
  "hybrid",
];

function normalizeMode(raw: string | undefined): WorkspaceBillingMode | null {
  if (raw && MODES.includes(raw as WorkspaceBillingMode)) {
    return raw as WorkspaceBillingMode;
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const access = await getWorkspaceAccess(auth.supabase, auth.user.id, workspaceId);
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: ws, error } = await auth.supabase
    .from("workspaces")
    .select("id, name, billing_mode, owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({
    workspace_id: ws.id,
    workspace_name: ws.name,
    billing_mode: ws.billing_mode ?? "personal_credits",
    can_manage: access.canManageMembers,
    is_owner: access.role === "owner",
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const adminWrap = requireServiceAdmin();
  if ("error" in adminWrap) return adminWrap.error;

  const access = await getWorkspaceAccess(auth.supabase, auth.user.id, workspaceId);
  if (!access?.canManageMembers || access.role !== "owner") {
    return NextResponse.json(
      { error: "Only the workspace owner can change billing mode" },
      { status: 403 },
    );
  }

  let body: { billing_mode?: string };
  try {
    body = (await req.json()) as { billing_mode?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = normalizeMode(body.billing_mode);
  if (!mode) {
    return NextResponse.json(
      { error: "billing_mode must be personal_credits, workspace_sponsored, or hybrid" },
      { status: 400 },
    );
  }

  const { data, error } = await adminWrap.admin
    .from("workspaces")
    .update({ billing_mode: mode } as never)
    .eq("id", workspaceId)
    .select("id, billing_mode")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    workspace_id: data.id,
    billing_mode: data.billing_mode,
  });
}
