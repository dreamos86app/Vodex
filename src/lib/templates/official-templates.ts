/**
 * Six production official templates — each must have real source files via template-source-files.
 */
import type { Template } from "@/lib/templates/template-types";

export const OFFICIAL_TEMPLATE_IDS = [
  "ai-saas-starter",
  "mobile-twa-play-store",
  "analytics-dashboard",
  "marketplace-starter",
  "community-platform",
  "landing-waitlist",
] as const;

export type OfficialTemplateId = (typeof OFFICIAL_TEMPLATE_IDS)[number];

export const OFFICIAL_TEMPLATES: Template[] = [
  {
    id: "ai-saas-starter",
    name: "AI SaaS Starter",
    description:
      "Auth, billing hooks, AI chat, credit usage UI, and settings — a production SaaS skeleton you can ship.",
    category: "saas",
    gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/15",
    accent: "#4d8dff",
    tags: ["Auth", "Billing", "AI", "Dashboard"],
    complexity: "advanced",
    popular: true,
    prompt:
      "Production AI SaaS with authentication, subscription billing placeholders, AI chat, and usage dashboard",
  },
  {
    id: "mobile-twa-play-store",
    name: "Mobile TWA / Play Store Ready App",
    description:
      "Mobile-first Next.js app with Capacitor/TWA manifest stubs, onboarding, and Play Store readiness checklist.",
    category: "mobile",
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/15",
    accent: "#14b8a6",
    tags: ["Capacitor", "TWA", "Android", "PWA"],
    complexity: "advanced",
    popular: true,
    prompt:
      "Mobile-first web app prepared for Capacitor wrap and Trusted Web Activity Play Store publishing",
  },
  {
    id: "analytics-dashboard",
    name: "Analytics Dashboard",
    description:
      "KPI cards, charts, filters, and export-ready tables wired to sample analytics data.",
    category: "enterprise",
    gradient: "from-cyan-500/20 via-sky-500/10 to-blue-500/15",
    accent: "#06b6d4",
    tags: ["Charts", "KPIs", "Filters", "Export"],
    complexity: "medium",
    popular: true,
    prompt: "Analytics dashboard with KPI cards, charts, date filters, and data tables",
  },
  {
    id: "marketplace-starter",
    name: "Marketplace",
    description:
      "Browse listings, seller profiles, cart flow, and checkout placeholders for a two-sided marketplace.",
    category: "marketplace",
    gradient: "from-amber-500/20 via-orange-500/10 to-yellow-500/15",
    accent: "#f59e0b",
    tags: ["Listings", "Cart", "Sellers", "Checkout"],
    complexity: "advanced",
    prompt: "Two-sided marketplace with listings, search, seller pages, and cart",
  },
  {
    id: "community-platform",
    name: "Community Platform",
    description:
      "Posts, profiles, reactions, and moderation-ready community feeds with realtime-friendly structure.",
    category: "community",
    gradient: "from-rose-500/20 via-pink-500/10 to-fuchsia-500/15",
    accent: "#f43f5e",
    tags: ["Feed", "Profiles", "Moderation", "Realtime"],
    complexity: "advanced",
    prompt: "Community platform with posts, profiles, reactions, and moderation tools",
  },
  {
    id: "landing-waitlist",
    name: "Landing + Waitlist",
    description:
      "High-conversion landing page with hero, social proof, pricing, FAQ, and email waitlist capture.",
    category: "saas",
    gradient: "from-indigo-500/20 via-violet-500/10 to-purple-500/15",
    accent: "#8b5cf6",
    tags: ["Landing", "Waitlist", "Pricing", "FAQ"],
    complexity: "medium",
    new: true,
    prompt: "Landing page with waitlist signup, pricing section, FAQ, and referral hooks",
  },
];

export function getOfficialTemplatePreviewUrl(id: string): string {
  return `/templates/previews/${id}.svg`;
}

/** Official templates shown in UI (all six have verified starter source files). */
export function listOfficialTemplatesWithSources(): Template[] {
  return [...OFFICIAL_TEMPLATES];
}

export function isOfficialTemplateId(id: string): boolean {
  return OFFICIAL_TEMPLATE_IDS.includes(id as OfficialTemplateId);
}
