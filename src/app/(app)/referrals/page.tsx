import type { Metadata } from "next";
import { ReferralsDashboard } from "@/components/referrals/referrals-dashboard";

export const metadata: Metadata = {
  title: "Referrals — DreamOS86",
  description: "Invite friends and earn credits.",
};

export default function ReferralsPage() {
  return (
    <div className="px-6 py-6 sm:px-10 sm:py-10">
      <ReferralsDashboard />
    </div>
  );
}
