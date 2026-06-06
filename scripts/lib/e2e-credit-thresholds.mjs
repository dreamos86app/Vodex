/** Minimum balances for live restaurant E2E (Build + Action credits). */
export const E2E_MIN_BUILD_CREDITS = 200;
/** ZIP preview build catalog floor is 140 AC — E2E harness must exceed it. */
export const E2E_MIN_ACTION_CREDITS = 500;

export function allowE2eCreditPrepare(env = process.env) {
  if (env.E2E_RUN_LIVE === "1" || env.ALLOW_E2E_CREDIT_PREPARE === "1") return true;
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production") return false;
  if (env.NODE_ENV === "test" || env.NODE_ENV === "development") return true;
  return true;
}
