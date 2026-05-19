import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { logAdminAudit } from "@/lib/admin/audit-log";
import { listAdminUsers } from "@/lib/admin/list-users";
import type { PlanId } from "@/lib/supabase/types";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_tokens"),
    amount: z.number().int().min(1).max(1_000_000),
    reason: z.string().min(1).max(500),
    confirmOwner: z.literal(true),
  }),
  z.object({
    action: z.literal("set_balance"),
    balance: z.number().int().min(0).max(10_000_000),
    reason: z.string().min(1).max(500),
    confirmOwner: z.literal(true),
  }),
  z.object({
    action: z.literal("reset_monthly"),
    reason: z.string().min(1).max(500),
    confirmOwner: z.literal(true),
  }),
  z.object({
    action: z.literal("set_plan"),
    planId: z.enum(["free", "starter", "pro", "business", "infinity", "enterprise"]),
    reason: z.string().min(1).max(500),
    confirmOwner: z.literal(true),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().min(1).max(500),
    confirmOwner: z.literal(true),
  }),
  z.object({
    action: z.literal("unsuspend"),
    reason: z.string().min(1).max(500).optional(),
    confirmOwner: z.literal(true),
  }),
]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const { users, error } = await listAdminUsers({ q: id, limit: 500 });
  if (error) return NextResponse.json({ error }, { status: 500 });

  const user = users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const admin = createSupabaseAdmin();

  const [usageRes, jobsRes, ledgerRes] = await Promise.all([
    admin
      .from("ai_usage_logs")
      .select("id,created_at,model_id,tokens_charged,status")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("build_jobs")
      .select("id,created_at,status,project_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("token_ledger")
      .select("id,created_at,amount,source,reason")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return NextResponse.json({
    user,
    usage: usageRes.data ?? [],
    buildJobs: jobsRes.data ?? [],
    tokenLedger: ledgerRes.data ?? [],
    ledgerError: ledgerRes.error?.message ?? null,
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;
  const { user: adminUser } = gate;

  const { id: targetUserId } = await ctx.params;
  const body = await request.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const payload = parsed.data;

  const adminDb = createSupabaseAdmin();
  const { data: beforeProfile } = await adminDb
    .from("profiles")
    .select("plan_id,credits_remaining,suspended_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!beforeProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let actionLabel: string;
  let rpcResult: { success?: boolean; error?: string } | null = null;
  let rpcError: { message: string } | null = null;

  switch (payload.action) {
    case "add_tokens": {
      actionLabel = "add_tokens";
      const { data, error } = await supabase.rpc("admin_add_tokens", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_amount: payload.amount,
        p_reason: payload.reason,
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
    case "set_balance": {
      actionLabel = "set_token_balance";
      const { data, error } = await supabase.rpc("admin_set_token_balance", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_balance: payload.balance,
        p_reason: payload.reason,
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
    case "reset_monthly": {
      actionLabel = "reset_monthly_tokens";
      const { data, error } = await supabase.rpc("admin_reset_monthly_tokens", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_reason: payload.reason,
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
    case "set_plan": {
      actionLabel = "set_plan";
      const { data, error } = await supabase.rpc("admin_set_plan", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_plan: payload.planId as PlanId,
        p_reason: payload.reason,
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
    case "suspend": {
      actionLabel = "suspend_user";
      const { data, error } = await supabase.rpc("admin_set_suspended", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_suspended: true,
        p_reason: payload.reason,
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
    case "unsuspend": {
      actionLabel = "unsuspend_user";
      const { data, error } = await supabase.rpc("admin_set_suspended", {
        p_admin_id: adminUser.id,
        p_user_id: targetUserId,
        p_suspended: false,
        p_reason: payload.reason ?? "unsuspended",
      });
      rpcResult = data;
      rpcError = error;
      break;
    }
  }

  if (rpcError || !rpcResult?.success) {
    return NextResponse.json(
      { error: rpcResult?.error ?? rpcError?.message ?? "Action failed" },
      { status: 500 },
    );
  }

  const { data: afterProfile } = await adminDb
    .from("profiles")
    .select("plan_id,credits_remaining,suspended_at")
    .eq("id", targetUserId)
    .maybeSingle();

  await logAdminAudit(adminUser, actionLabel, {
    targetUserId,
    before: beforeProfile as Record<string, unknown>,
    after: (afterProfile ?? {}) as Record<string, unknown>,
    reason: "reason" in payload ? payload.reason : null,
    amount: "amount" in payload ? payload.amount : null,
    request,
  });

  if (payload.action === "add_tokens") {
    await adminDb.from("notifications").insert({
      user_id: targetUserId,
      type: "credit",
      title: `${payload.amount} tokens added`,
      body: `Support granted ${payload.amount} tokens. Reason: ${payload.reason}`,
      action_url: "/credits",
    });
  }

  const { users } = await listAdminUsers({ q: targetUserId, limit: 1 });
  return NextResponse.json({ success: true, user: users[0] ?? null });
}
