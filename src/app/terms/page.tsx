import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/marketing/legal-document-shell";
import { TermsContent } from "@/components/marketing/legal/terms-content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Terms",
  description: "Vodex Terms of Service — rules for using the AI-native app platform.",
};

export default function TermsPage() {
  return (
    <LegalDocumentShell>
      <TermsContent />
    </LegalDocumentShell>
  );
}
