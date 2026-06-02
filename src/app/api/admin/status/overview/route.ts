import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { STATUS_SCHEMA_INSTALL_HINT, isStatusSchemaMissingError } from "@/lib/status/status-db";
import { checkStatusSchemaReady, fetchPublicStatusPayload } from "@/lib/status/status-public";

export async function GET() {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const schemaReady = await checkStatusSchemaReady();
  if (!schemaReady) {
    return NextResponse.json({
      schemaReady: false,
      hint: STATUS_SCHEMA_INSTALL_HINT,
      components: [],
      announcements: [],
    });
  }

  const payload = await fetchPublicStatusPayload();
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ schemaReady: false, error: "Service role unavailable" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: announcements, error } = await db
    .from("platform_announcements")
    .select(
      "id,title,message,severity,banner_type,is_active,priority,link_label,link_url,gradient_from,gradient_to,text_color,icon_type,starts_at,ends_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error && isStatusSchemaMissingError(error)) {
    return NextResponse.json({
      schemaReady: false,
      hint: STATUS_SCHEMA_INSTALL_HINT,
      components: [],
      announcements: [],
    });
  }

  return NextResponse.json({
    schemaReady: true,
    components: payload.ok ? payload.components : [],
    announcements: announcements ?? [],
    hint: null,
  });
}
