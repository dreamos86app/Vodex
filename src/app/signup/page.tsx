import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth/session";
import { REFERRAL_NOTICE_QUERY } from "@/lib/referrals/referral-messages";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Alias /signup?ref=… → /auth/signup (preserves query). Logged-in users go home with notice. */
export default async function SignupAliasPage({ searchParams }: Props) {
  const user = await getServerSessionUser();
  if (user) {
    redirect(`/?${REFERRAL_NOTICE_QUERY}=existing_user`);
  }

  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) val.forEach((v) => q.append(key, v));
    else q.set(key, val);
  }
  const suffix = q.toString();
  redirect(suffix ? `/auth/signup?${suffix}` : "/auth/signup");
}
