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
  const reasons: Record<string, string> = {};

  for (const p of providers) {
    const s = getProviderStatus(p);
    if (p === "xai" || s.status === "coming_soon") {
      status[p] = "coming_soon";
      reasons[p] = "Coming soon on this platform.";
    } else if (
      !s.configured ||
      s.disabled ||
      s.status === "quota_exhausted" ||
      s.status === "auth_error" ||
      s.status === "degraded"
    ) {
      status[p] = "unavailable";
      if (!s.configured) reasons[p] = "API not configured for this provider.";
      else if (s.disabled) reasons[p] = s.disabledReason ?? "Provider disabled.";
      else if (s.status === "quota_exhausted") reasons[p] = "Provider quota exhausted.";
      else if (s.status === "auth_error") reasons[p] = "Provider authentication error.";
      else if (s.status === "degraded") {
        reasons[p] =
          s.lastErrorClass === "rate_limited"
            ? "Rate limited — temporarily unavailable."
            : "Provider temporarily unavailable.";
      } else reasons[p] = "Currently unavailable.";
    } else {
      status[p] = "available";
    }
  }

  return NextResponse.json(
    { checkedAt: new Date().toISOString(), providers: status, unavailableReasons: reasons },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
