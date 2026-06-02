import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
    linkLabel?: string;
    linkUrl?: string;
    template?: string;
  };

  const templates: Record<string, { title: string; message: string }> = {
    builder_degraded: {
      title: "Technical issue affecting app generation",
      message:
        "We're aware of an issue affecting the builder. Some generations may fail or take longer than usual. We're working to resolve it as quickly as possible.",
    },
    platform_issue: {
      title: "Some Vodex services are affected",
      message:
        "We're aware of a technical issue affecting some services. We're actively investigating and will post updates on the status page.",
    },
    maintenance: {
      title: "Scheduled maintenance in progress",
      message:
        "Vodex is undergoing scheduled maintenance. Some features may be temporarily unavailable.",
    },
    billing_issue: {
      title: "Billing service interruption",
      message:
        "Checkout or subscription management may be temporarily unavailable. Existing apps and data are not affected.",
    },
    preview_issue: {
      title: "Preview rendering issue",
      message:
        "Some generated app previews may not load correctly. Builds are saved and can be repaired once service is restored.",
    },
  };

  const tpl = body.template ? templates[body.template] : null;
  const title = body.title?.trim() || tpl?.title;
  const message = body.message?.trim() || tpl?.message;
  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  await db.from("platform_announcements").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await db
    .from("platform_announcements")
    .insert({
      title,
      message,
      severity: body.severity ?? "incident",
      link_label: body.linkLabel ?? "Status Page",
      link_url: body.linkUrl ?? "https://status.vodex.dev",
      is_active: true,
      starts_at: new Date().toISOString(),
      created_by: owner.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
