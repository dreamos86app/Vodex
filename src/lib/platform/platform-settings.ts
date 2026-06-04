import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_PREVIEW_COST_MULTIPLIER = 3.0;

export async function getPreviewCostMultiplier(): Promise<number> {
  const admin = createSupabaseAdmin();
  if (!admin) return DEFAULT_PREVIEW_COST_MULTIPLIER;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "preview_cost_multiplier")
    .maybeSingle();

  const raw = data?.value;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return DEFAULT_PREVIEW_COST_MULTIPLIER;
}
