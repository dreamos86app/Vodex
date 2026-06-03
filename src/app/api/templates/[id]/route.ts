import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const templateId = id?.trim();
  if (!templateId) {
    return NextResponse.json({ error: "Template id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("templates")
    .select("id, owner_id, is_official")
    .eq("id", templateId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.is_official) {
    return NextResponse.json({ error: "Official templates cannot be deleted" }, { status: 403 });
  }

  if (row.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("templates").delete().eq("id", templateId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
