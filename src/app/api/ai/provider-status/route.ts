import { NextResponse } from "next/server";
import {
  getProviderStatus,
  recoverConfiguredProvidersFromAuthError,
} from "@/lib/ai/provider-availability";
import type { ProviderName } from "@/lib/ai/provider-errors";

export const dynamic = "force-dynamic";

/** Public-safe provider availability — no balances, keys, or quota wording. */
export async function GET() {
  recoverConfiguredProvidersFromAuthError();
  const providers: ProviderName[] = ["anthropic", "openai", "google", "xai"];
  const status: Record<string, "available" | "unavailable" | "coming_soon"> = {};

  for (const p of providers) {
    const s = getProviderStatus(p);
    if (p === "xai" || s.status === "coming_soon") {
      status[p] = "coming_soon";
    } else if (!s.configured || s.disabled || s.status === "quota_exhausted" || s.status === "auth_error") {
      status[p] = "unavailable";
    } else {
      status[p] = "available";
    }
  }

  return NextResponse.json(
    { checkedAt: new Date().toISOString(), providers: status },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
