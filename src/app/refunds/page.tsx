import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/marketing/legal-document-shell";
import { RefundContent } from "@/components/marketing/legal/refund-content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Vodex refund policy for subscriptions, Build Credits, Action Credits, and generated app payments.",
};

export default function RefundsPage() {
  return (
    <LegalDocumentShell>
      <RefundContent />
    </LegalDocumentShell>
  );
}
