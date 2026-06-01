import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/marketing/legal-document-shell";
import { PrivacyContent } from "@/components/marketing/legal/privacy-content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Privacy",
  description: "Vodex Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentShell>
      <PrivacyContent />
    </LegalDocumentShell>
  );
}
