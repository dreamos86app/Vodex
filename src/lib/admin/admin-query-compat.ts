import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

export function parseAdminPagination(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
  return { limit, offset };
}

export type AiUsageLogRow = {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  model_id: string;
  mode: string;
  tokens_charged: number;
  tokens_input: number | null;
  tokens_output: number | null;
  status: string;
  error_message: string | null;
  conversation_id: string | null;
  operation_id: string | null;
};

const AI_USAGE_SELECT_PRIMARY =
  "id,created_at,user_id,user_email,model_id,mode,tokens_charged,tokens_input,tokens_output,status,error_message,conversation_id,operation_id";

const AI_USAGE_SELECT_FALLBACK =
  "id,created_at,user_id,user_email,model_id,mode,credits_charged,tokens_input,tokens_output,status,error_message,conversation_id,operation_id";

function normalizeAiUsageRow(row: Record<string, unknown>): AiUsageLogRow {
  const charged =
    typeof row.tokens_charged === "number"
      ? row.tokens_charged
      : typeof row.credits_charged === "number"
        ? row.credits_charged
        : 0;
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    user_id: String(row.user_id),
    user_email: String(row.user_email ?? ""),
    model_id: String(row.model_id),
    mode: String(row.mode),
    tokens_charged: charged,
    tokens_input: (row.tokens_input as number | null) ?? null,
    tokens_output: (row.tokens_output as number | null) ?? null,
    status: String(row.status),
    error_message: (row.error_message as string | null) ?? null,
    conversation_id: (row.conversation_id as string | null) ?? null,
    operation_id: (row.operation_id as string | null) ?? null,
  };
}

export async function fetchAiUsageLogs(
  admin: AdminClient,
  opts: { limit: number; offset: number; successOnly?: boolean; sinceIso?: string },
): Promise<{ rows: AiUsageLogRow[]; error?: string; columnHint?: string }> {
  const build = (select: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (admin as any)
      .from("ai_usage_logs")
      .select(select)
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.successOnly) q = q.eq("status", "success");
    if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);
    return q;
  };

  let res = await build(AI_USAGE_SELECT_PRIMARY);
  if (res.error?.message?.includes("tokens_charged")) {
    res = await build(AI_USAGE_SELECT_FALLBACK);
    if (!res.error) {
      return {
        rows: (res.data ?? []).map((r: Record<string, unknown>) => normalizeAiUsageRow(r)),
        columnHint: "Using credits_charged — run scripts/admin-column-compat.sql and NOTIFY pgrst, 'reload schema';",
      };
    }
  }

  if (res.error?.message?.includes("tokens_input")) {
    const minimal =
      "id,created_at,user_id,user_email,model_id,mode,tokens_charged,status,error_message,conversation_id,operation_id";
    res = await build(minimal);
    if (!res.error) {
      return {
        rows: (res.data ?? []).map((r: Record<string, unknown>) => normalizeAiUsageRow(r)),
        columnHint:
          "tokens_input missing — run scripts/admin-column-compat.sql and NOTIFY pgrst, 'reload schema';",
      };
    }
  }

  if (res.error) {
    return { rows: [], error: res.error.message };
  }

  return {
    rows: (res.data ?? []).map((r: Record<string, unknown>) => normalizeAiUsageRow(r)),
  };
}

export async function fetchAiUsageSummaryRows(
  admin: AdminClient,
  sinceIso: string,
): Promise<{ rows: Array<{ model_id: string; mode: string; tokens_charged: number; tokens_input: number | null; tokens_output: number | null; status: string; conversation_id: string | null }>; error?: string }> {
  const primary = await admin
    .from("ai_usage_logs")
    .select("model_id,mode,tokens_charged,tokens_input,tokens_output,status,conversation_id")
    .eq("status", "success")
    .gte("created_at", sinceIso);

  if (!primary.error) {
    return {
      rows: (primary.data ?? []).map((r) => ({
        model_id: r.model_id,
        mode: r.mode,
        tokens_charged: r.tokens_charged ?? 0,
        tokens_input: r.tokens_input,
        tokens_output: r.tokens_output,
        status: r.status,
        conversation_id: r.conversation_id,
      })),
    };
  }

  if (
    !primary.error?.message?.includes("tokens_charged") &&
    !primary.error?.message?.includes("tokens_input")
  ) {
    return { rows: [], error: primary.error.message };
  }

  if (primary.error?.message?.includes("tokens_input")) {
    const noTok = await admin
      .from("ai_usage_logs")
      .select("model_id,mode,tokens_charged,status,conversation_id")
      .eq("status", "success")
      .gte("created_at", sinceIso);
    if (!noTok.error) {
      return {
        rows: (noTok.data ?? []).map((r) => ({
          model_id: r.model_id,
          mode: r.mode,
          tokens_charged: r.tokens_charged ?? 0,
          tokens_input: null,
          tokens_output: null,
          status: r.status,
          conversation_id: r.conversation_id,
        })),
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallback = await (admin as any)
    .from("ai_usage_logs")
    .select("model_id,mode,credits_charged,tokens_input,tokens_output,status,conversation_id")
    .eq("status", "success")
    .gte("created_at", sinceIso);

  if (fallback.error) {
    return { rows: [], error: fallback.error.message };
  }

  return {
    rows: (fallback.data ?? []).map((r: { model_id: string; mode: string; credits_charged?: number; tokens_input: number | null; tokens_output: number | null; status: string; conversation_id: string | null }) => ({
      model_id: r.model_id,
      mode: r.mode,
      tokens_charged: (r as { credits_charged?: number }).credits_charged ?? 0,
      tokens_input: r.tokens_input,
      tokens_output: r.tokens_output,
      status: r.status,
      conversation_id: r.conversation_id,
    })),
  };
}

export type AdminActionRow = {
  id: string;
  created_at: string;
  admin_id: string;
  target_id: string;
  action_type: string;
  amount: number | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export async function fetchAdminActions(
  admin: AdminClient,
  opts: { limit: number; offset: number },
): Promise<{ rows: AdminActionRow[]; error?: string }> {
  const primary = await admin
    .from("admin_actions")
    .select("id,created_at,admin_id,target_id,action_type,amount,reason,metadata")
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (!primary.error) {
    return { rows: (primary.data ?? []) as AdminActionRow[] };
  }

  if (primary.error?.message?.includes("target_id")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyTarget = await (admin as any)
      .from("admin_actions")
      .select("id,created_at,admin_id,target_user_id,action_type,amount,reason,metadata")
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (!legacyTarget.error) {
      return {
        rows: ((legacyTarget.data ?? []) as Record<string, unknown>[]).map((l) => ({
          id: String(l.id),
          created_at: String(l.created_at),
          admin_id: String(l.admin_id),
          target_id: String(l.target_user_id ?? ""),
          action_type: String(l.action_type),
          amount: (l.amount as number | null) ?? null,
          reason: (l.reason as string | null) ?? null,
          metadata: (l.metadata ?? {}) as Record<string, unknown>,
        })),
      };
    }
  }

  if (
    !primary.error?.message?.includes("admin_id") &&
    !primary.error?.message?.includes("action_type")
  ) {
    return { rows: [], error: primary.error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = await (admin as any)
    .from("admin_actions")
    .select("id,created_at,actor_id,target_user_id,action,amount,reason,metadata")
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (legacy.error) {
    return { rows: [], error: legacy.error.message as string };
  }

  return {
    rows: ((legacy.data ?? []) as Record<string, unknown>[]).map((l) => ({
      id: String(l.id),
      created_at: String(l.created_at),
      admin_id: String(l.actor_id ?? l.admin_id),
      target_id: String(l.target_id ?? l.target_user_id),
      action_type: String(l.action_type ?? l.action),
      amount: (l.amount as number | null) ?? null,
      reason: (l.reason as string | null) ?? null,
      metadata: (l.metadata ?? {}) as Record<string, unknown>,
    })),
  };
}

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_downgrade_plan: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
};

export async function fetchSubscriptions(
  admin: AdminClient,
  opts: { limit: number; offset: number },
): Promise<{ rows: SubscriptionRow[]; error?: string }> {
  const withPrice = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_downgrade_plan,stripe_subscription_id,stripe_customer_id,stripe_price_id,created_at",
    )
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (!withPrice.error) {
    return { rows: (withPrice.data ?? []) as SubscriptionRow[] };
  }

  if (withPrice.error?.message?.includes("pending_downgrade_plan")) {
    const legacyPlan = await admin
      .from("subscriptions")
      .select(
        "id,user_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_downgrade,stripe_subscription_id,stripe_customer_id,stripe_price_id,created_at",
      )
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (!legacyPlan.error && legacyPlan.data) {
      return {
        rows: (legacyPlan.data as unknown[]).map((s) => {
          const row = s as Record<string, unknown>;
          return {
            id: String(row.id),
            user_id: String(row.user_id),
            plan_id: String(row.plan_id),
            status: String(row.status),
            current_period_start: (row.current_period_start as string | null) ?? null,
            current_period_end: (row.current_period_end as string | null) ?? null,
            cancel_at_period_end: Boolean(row.cancel_at_period_end),
            pending_downgrade_plan: (row.pending_downgrade as string | null) ?? null,
            stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
            stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
            stripe_price_id: (row.stripe_price_id as string | null) ?? null,
            created_at: String(row.created_at),
          };
        }),
      };
    }
  }

  if (!withPrice.error?.message?.includes("stripe_price_id")) {
    return { rows: [], error: withPrice.error.message };
  }

  const without = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_downgrade_plan,stripe_subscription_id,stripe_customer_id,created_at",
    )
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (without.error) {
    return { rows: [], error: without.error.message };
  }

  return {
    rows: (without.data ?? []).map((s) => ({
      ...s,
      stripe_price_id: null,
      current_period_start: (s as { current_period_start?: string | null }).current_period_start ?? null,
    })) as SubscriptionRow[],
  };
}
