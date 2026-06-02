import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getBannerTemplate } from "@/lib/status/announcement-templates";
import { isStatusSchemaMissingError, STATUS_SCHEMA_INSTALL_HINT } from "@/lib/status/status-db";

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const body = (await request.json()) as {
    title?: string;
    message?: string;
    severity?: string;
    bannerType?: string;
    linkLabel?: string;
    linkUrl?: string;
    template?: string;
    priority?: number;
    gradientFrom?: string;
    gradientTo?: string;
    textColor?: string;
    iconType?: string;
    deactivateOthers?: boolean;
  };

  const tpl = body.template ? getBannerTemplate(body.template) : null;
  const title = body.title?.trim() || tpl?.title;
  const message = body.message?.trim() || tpl?.message;
  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  if (body.deactivateOthers) {
    await db.from("platform_announcements").update({ is_active: false }).eq("is_active", true);
  }

  const { data, error } = await db
    .from("platform_announcements")
    .insert({
      title,
      message,
      severity: body.severity ?? tpl?.severity ?? "incident",
      banner_type: body.bannerType ?? tpl?.bannerType ?? "incident",
      link_label: body.linkLabel ?? tpl?.linkLabel ?? "Status Page",
      link_url: body.linkUrl ?? tpl?.linkUrl ?? "https://status.vodex.dev",
      gradient_from: body.gradientFrom ?? tpl?.gradientFrom ?? "#DC2626",
      gradient_to: body.gradientTo ?? tpl?.gradientTo ?? "#EF4444",
      text_color: body.textColor ?? tpl?.textColor ?? "#ffffff",
      icon_type: body.iconType ?? tpl?.iconType ?? "alert",
      priority: body.priority ?? tpl?.priority ?? 100,
      is_active: true,
      starts_at: new Date().toISOString(),
      created_by: owner.user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isStatusSchemaMissingError(error)) {
      return NextResponse.json({ error: STATUS_SCHEMA_INSTALL_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
