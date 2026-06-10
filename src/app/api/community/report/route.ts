import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createContactRequest } from "@/lib/contact/save-contact-request";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetType: z.enum(["profile", "group", "discussion", "message"]),
  targetId: z.string().min(1),
  targetLabel: z.string().min(1),
  reason: z.string().min(1),
  details: z.string().optional(),
  reporterName: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report payload" }, { status: 400 });
  }

  const { targetType, targetId, targetLabel, reason, details, reporterName } = parsed.data;
  const message = [
    `Reported: ${targetType} — ${targetLabel}`,
    `Target ID: ${targetId}`,
    `Reason: ${reason}`,
    details?.trim() ? `Details: ${details.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await createContactRequest({
    source: "community_report",
    kind: "report",
    name: reporterName?.trim() || user.email?.split("@")[0] || "Member",
    email: user.email ?? "noreply@vodex.dev",
    subject: `Community report: ${targetLabel}`,
    reason,
    message,
    user_id: user.id,
    priority: "high",
    metadata: { targetType, targetId, targetLabel },
    isPlatformContact: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.request.id });
}
