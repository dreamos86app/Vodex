import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/marketing/legal-document-shell";
import { PrivacyContent } from "@/components/marketing/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy",
  description: "DreamOS86 Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentShell>
      <PrivacyContent />
    </LegalDocumentShell>
  );
}
