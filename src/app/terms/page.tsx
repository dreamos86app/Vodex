import type { Metadata } from "next";
import { PublicMarketingShell } from "@/components/marketing/public-marketing-shell";
import { TermsContent } from "@/components/marketing/legal/terms-content";

export const metadata: Metadata = {
  title: "Terms",
  description: "DreamOS86 Terms of Service — rules for using the AI-native app platform.",
};

export default function TermsPage() {
  return (
    <PublicMarketingShell>
      <TermsContent />
    </PublicMarketingShell>
  );
}
