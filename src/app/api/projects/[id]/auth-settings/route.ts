import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data } = (await admin
    .from("app_auth_provider_settings" as never)
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle()) as { data: Record<string, unknown> | null };

  const settings = data ?? {
    email_password_enabled: true,
    google_enabled: false,
    github_enabled: false,
    apple_enabled: false,
    oauth_mode: "vodex_managed",
  };

  return NextResponse.json({ settings });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const payload = {
    project_id: projectId,
    owner_id: user.id,
    email_password_enabled: body.email_password_enabled !== false,
    google_enabled: body.google_enabled === true,
    github_enabled: body.github_enabled === true,
    apple_enabled: body.apple_enabled === true,
    oauth_mode: body.oauth_mode === "custom" ? "custom" : "vodex_managed",
    updated_at: new Date().toISOString(),
  };

  await admin
    .from("app_auth_provider_settings" as never)
    .upsert(payload as never, { onConflict: "project_id" });

  return NextResponse.json({ ok: true, settings: payload });
}
