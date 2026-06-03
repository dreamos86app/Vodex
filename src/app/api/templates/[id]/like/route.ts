import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
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

  const { data: existing } = await supabase
    .from("template_likes")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("template_likes")
      .delete()
      .eq("template_id", templateId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ liked: false });
  }

  const { error } = await supabase.from("template_likes").insert({
    template_id: templateId,
    user_id: user.id,
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ liked: true });
}
