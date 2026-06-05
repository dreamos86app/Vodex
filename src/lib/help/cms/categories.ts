import type { HelpCategory } from "@/lib/help/cms/types";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Create your first app, understand the workspace, and launch with confidence.",
    icon: "rocket",
  },
  {
    slug: "publishing",
    title: "Publishing Apps",
    description: "Publish to the web, verify your live URL, and ship updates safely.",
    icon: "globe",
  },
  {
    slug: "authentication",
    title: "Authentication",
    description: "Google, GitHub, email, OAuth, and published-app sign-in.",
    icon: "shield",
  },
  {
    slug: "integrations",
    title: "Integrations",
    description: "Connect GitHub, Supabase, email, AI, and backend services step by step.",
    icon: "plug",
  },
  {
    slug: "payments",
    title: "Payments",
    description: "Stripe, PayPal, Paddle, Lemon Squeezy, RevenueCat — sandbox to production.",
    icon: "credit-card",
  },
  {
    slug: "mobile-apps",
    title: "Mobile Apps",
    description: "Android and iOS publishing, signing, store listings, and RevenueCat.",
    icon: "smartphone",
  },
  {
    slug: "analytics",
    title: "Analytics",
    description: "Insights, users, growth, and revenue dashboards for published apps.",
    icon: "bar-chart",
  },
  {
    slug: "domains",
    title: "Domains",
    description: "Custom domains, DNS, SSL, and provider-specific setup.",
    icon: "link",
  },
  {
    slug: "ai-providers",
    title: "AI Providers",
    description: "OpenAI, Anthropic, Gemini — keys, billing, and runtime usage.",
    icon: "sparkles",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Common errors, OAuth issues, webhooks, and deployment fixes.",
    icon: "alert-circle",
  },
];

export function getCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}
