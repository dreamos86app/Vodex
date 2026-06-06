import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CanonicalCreditsPayload } from "@/lib/credits/canonical-credits";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";

const E2E_MIN_BUILD = 200;
/** ZIP preview floor is 140 AC — live E2E harness must exceed it when marker is present. */
const E2E_MIN_ACTION = 500;

type Marker = {
  userId?: string;
  email?: string;
  buildCredits?: number;
  actionCredits?: number;
};

export function readE2eCreditBypassMarker(): Marker | null {
  if (process.env.NODE_ENV === "production" && process.env.E2E_RUN_LIVE !== "1") {
    return null;
  }
  try {
    const markerPath = path.join(process.cwd(), ".e2e-credits-prepared.json");
    if (!fs.existsSync(markerPath)) return null;
    return JSON.parse(fs.readFileSync(markerPath, "utf8")) as Marker;
  } catch {
    return null;
  }
}

export function shouldApplyE2eCreditBypass(userId: string, email?: string | null): boolean {
  const marker = readE2eCreditBypassMarker();
  if (!marker) {
    return isE2eCreditTestAccount(email);
  }
  const e = email?.trim().toLowerCase() ?? "";
  if (marker.userId && marker.userId === userId) return true;
  if (marker.email && e && marker.email.toLowerCase() === e) return true;
  return false;
}

/** Honor raw DB balances for live E2E — bypass inflation repair/clamp. */
export function applyE2eCreditBypassDisplay(
  payload: CanonicalCreditsPayload,
  rawBuild: number,
  rawAction: number,
): CanonicalCreditsPayload {
  const marker = readE2eCreditBypassMarker();
  const build = Math.max(rawBuild, marker?.buildCredits ?? E2E_MIN_BUILD);
  const action = Math.max(rawAction, marker?.actionCredits ?? E2E_MIN_ACTION);
  return {
    ...payload,
    build: {
      ...payload.build,
      available: build,
      bonusActive: Math.max(0, build - payload.build.planAllowance),
    },
    action: {
      ...payload.action,
      available: action,
      bonusActive: Math.max(0, action - payload.action.planAllowance),
    },
  };
}
