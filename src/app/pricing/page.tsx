import type { Metadata } from "next";
import { PricingPageShell } from "@/components/pricing/pricing-page-shell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DreamOS86 pricing — Free, Starter, Pro, and Infinity plans with Build Credits and Action Credits.",
};

export default function PricingPage() {
  return <PricingPageShell />;
}
