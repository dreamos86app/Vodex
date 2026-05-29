import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ code: string }>;
};

/** Short referral path /r/CODE → signup with ref (format unchanged for share links). */
export default async function ReferralShortLinkPage({ params }: Props) {
  const { code } = await params;
  const raw = code?.trim() ?? "";
  if (!raw) {
    redirect("/auth/signup");
  }
  redirect(`/auth/signup?ref=${encodeURIComponent(raw)}`);
}
