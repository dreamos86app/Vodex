import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** Persist optional marketing opt-in from Paddle checkout/customer payloads. */
export async function syncPaddleMarketingConsent(
  userId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const customer = data.customer as { marketing_consent?: boolean } | undefined;
  const custom = (data.custom_data ?? {}) as Record<string, unknown>;
  const consent =
    typeof customer?.marketing_consent === "boolean"
      ? customer.marketing_consent
      : typeof custom.marketing_consent === "boolean"
        ? custom.marketing_consent
        : null;

  if (consent === null) return;

  const admin = createSupabaseAdmin();
  await admin.from("user_settings").upsert(
    {
      user_id: userId,
      marketing_emails: consent,
    } as never,
    { onConflict: "user_id" },
  );
}
