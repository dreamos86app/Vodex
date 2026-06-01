import type { Metadata } from "next";
import { PricingPageShell } from "@/components/pricing/pricing-page-shell";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Vodex pricing — Free, Starter, Pro, and Infinity plans with Build Credits and Action Credits.",
};

export default function PricingPage() {
  return <PricingPageShell />;
}
