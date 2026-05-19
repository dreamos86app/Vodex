import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { logAdminAudit } from "@/lib/admin/audit-log";

const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(1).max(100000),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;
  const { user } = gate;
  const supabase = await createClient();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { userId, amount, reason } = parsed.data;

  const { data: result } = await supabase.rpc("grant_credits", {
    p_admin_id: user.id,
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });

  if (!result?.success) {
    return NextResponse.json({ error: result?.error ?? "Failed" }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "credit",
    title: `${amount} tokens added`,
    body: `An admin has granted you ${amount} tokens. Reason: ${reason}`,
    action_url: "/credits",
  });

  await logAdminAudit(user, "grant_tokens", {
    targetUserId: userId,
    amount,
    reason,
    request,
  });

  return NextResponse.json({ success: true });
}
