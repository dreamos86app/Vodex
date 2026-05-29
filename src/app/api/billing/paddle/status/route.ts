import { NextResponse } from "next/server";
import { getPaddleBillingStatus } from "@/lib/billing/paddle-billing";
import { validatePaddleEnvironmentConsistency } from "@/lib/billing/paddle-env-consistency";
import {
  paddleOwnerTestCheckoutEnabled,
  paddlePublicCheckoutEnabled,
} from "@/lib/billing/paddle-public-checkout";

/** DreamOS86 subscription billing setup state (Paddle). */
export async function GET() {
  const status = getPaddleBillingStatus();
  const env = validatePaddleEnvironmentConsistency();
  return NextResponse.json({
    ...status,
    envConsistencyOk: env.ok,
    envErrors: env.errors,
    publicCheckoutEnabled: paddlePublicCheckoutEnabled(),
    ownerTestCheckoutEnabled: paddleOwnerTestCheckoutEnabled(),
  });
}
