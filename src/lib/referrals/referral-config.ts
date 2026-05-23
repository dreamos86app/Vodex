/** Credits granted to referrer and referred user per successful referral. */
export const REFERRAL_CREDITS_PER_USER = 5;

/** Max invites per referrer. */
export const MAX_REFERRALS_PER_USER = 5;

/** Canonical share origin for invite links (always production domain). */
export const REFERRAL_SHARE_ORIGIN = "https://dreamos86.com";

export function buildReferralInviteUrl(code: string): string {
  return `${REFERRAL_SHARE_ORIGIN}/auth/sign-up?ref=${encodeURIComponent(code)}`;
}
