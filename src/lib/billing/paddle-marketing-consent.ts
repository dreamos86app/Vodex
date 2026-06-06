import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type PaddleMarketingConsentOptions = {
  /** When true, purchasers opt into product emails unless Paddle explicitly opts out. */
  purchaseDefaultOptIn?: boolean;
};

function readPaddleConsent(data: Record<string, unknown>): boolean | null {
  const customer = data.customer as { marketing_consent?: boolean } | undefined;
  const custom = (data.custom_data ?? {}) as Record<string, unknown>;
  if (typeof customer?.marketing_consent === "boolean") return customer.marketing_consent;
  if (typeof custom.marketing_consent === "boolean") return custom.marketing_consent;
  return null;
}

/** Persist marketing opt-in from Paddle checkout and sync profiles for email campaigns. */
export async function syncPaddleMarketingConsent(
  userId: string,
  data: Record<string, unknown>,
  options?: PaddleMarketingConsentOptions,
): Promise<void> {
  let consent = readPaddleConsent(data);
  if (consent === null && options?.purchaseDefaultOptIn) {
    consent = true;
  }
  if (consent === null) return;

  const admin = createSupabaseAdmin();
  await admin
    .from("profiles")
    .update({ marketing_emails_opt_in: consent } as never)
    .eq("id", userId);
  await admin.from("user_settings").upsert(
    {
      user_id: userId,
      marketing_emails: consent,
    } as never,
    { onConflict: "user_id" },
  );
}
