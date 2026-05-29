import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth/session";
import { sanitizeReferralCode } from "@/lib/auth/ref-cookie";
import { REFERRAL_NOTICE_QUERY } from "@/lib/referrals/referral-messages";

type Props = {
  params: Promise<{ code: string }>;
};

/** Short referral path /r/CODE → signup with ref (logged out) or home notice (logged in). */
export default async function ReferralShortLinkPage({ params }: Props) {
  const { code: raw } = await params;
  const code = sanitizeReferralCode(raw);
  if (!code) {
    redirect("/auth/signup");
  }

  const user = await getServerSessionUser();
  if (user) {
    redirect(`/?${REFERRAL_NOTICE_QUERY}=existing_user`);
  }

  redirect(`/auth/signup?ref=${encodeURIComponent(code)}`);
}
