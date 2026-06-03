/**
 * Integrations catalog — grouped cards for the Integrations UI (not secrets).
 */
export type IntegrationCategoryId =
  | "database"
  | "code"
  | "payments"
  | "email"
  | "ai"
  | "custom";

export type IntegrationConnectMode =
  | "oauth_github"
  | "oauth_supabase"
  | "project_oauth"
  | "chat_prompt"
  | "secrets_form";

export type IntegrationCatalogItem = {
  id: string;
  label: string;
  description: string;
  category: IntegrationCategoryId;
  categoryLabel: string;
  connectMode: IntegrationConnectMode;
  docsUrl: string;
  chatPrompt?: string;
};

export const INTEGRATION_CATEGORIES: { id: IntegrationCategoryId; label: string }[] = [
  { id: "database", label: "Database & Auth" },
  { id: "code", label: "Code & Deploy" },
  { id: "payments", label: "Payments" },
  { id: "email", label: "Email & Comms" },
  { id: "ai", label: "AI Providers" },
  { id: "custom", label: "Custom" },
];

export const INTEGRATIONS_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "supabase",
    label: "Supabase",
    description: "Postgres, auth, and storage for your generated app.",
    category: "database",
    categoryLabel: "Database & Auth",
    connectMode: "oauth_supabase",
    docsUrl: "https://supabase.com/docs",
  },
  {
    id: "firebase",
    label: "Firebase",
    description: "Firebase Auth and Firestore for mobile-first apps.",
    category: "database",
    categoryLabel: "Database & Auth",
    connectMode: "chat_prompt",
    docsUrl: "https://firebase.google.com/docs",
    chatPrompt:
      "Add Firebase Auth and Firestore to this app. Use environment variables for the service account and document the setup in README.",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Sync code, open PRs, and wire deploy hooks.",
    category: "code",
    categoryLabel: "Code & Deploy",
    connectMode: "oauth_github",
    docsUrl: "https://docs.github.com",
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Deploy previews and production for this app.",
    category: "code",
    categoryLabel: "Code & Deploy",
    connectMode: "secrets_form",
    docsUrl: "https://vercel.com/docs",
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Subscriptions and one-time checkout.",
    category: "payments",
    categoryLabel: "Payments",
    connectMode: "secrets_form",
    docsUrl: "https://stripe.com/docs",
  },
  {
    id: "paddle",
    label: "Paddle",
    description: "Merchant-of-record billing.",
    category: "payments",
    categoryLabel: "Payments",
    connectMode: "secrets_form",
    docsUrl: "https://developer.paddle.com",
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "PayPal checkout integration.",
    category: "payments",
    categoryLabel: "Payments",
    connectMode: "secrets_form",
    docsUrl: "https://developer.paypal.com",
  },
  {
    id: "lemonsqueezy",
    label: "Lemon Squeezy",
    description: "Digital products and license keys.",
    category: "payments",
    categoryLabel: "Payments",
    connectMode: "secrets_form",
    docsUrl: "https://docs.lemonsqueezy.com",
  },
  {
    id: "resend",
    label: "Resend",
    description: "Transactional email API.",
    category: "email",
    categoryLabel: "Email & Comms",
    connectMode: "secrets_form",
    docsUrl: "https://resend.com/docs",
  },
  {
    id: "discord",
    label: "Discord Webhook",
    description: "Post events to a Discord channel.",
    category: "email",
    categoryLabel: "Email & Comms",
    connectMode: "secrets_form",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Use your own OpenAI billing in the generated app.",
    category: "ai",
    categoryLabel: "AI Providers",
    connectMode: "secrets_form",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude models in your app backend.",
    category: "ai",
    categoryLabel: "AI Providers",
    connectMode: "secrets_form",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini API for your generated features.",
    category: "ai",
    categoryLabel: "AI Providers",
    connectMode: "secrets_form",
    docsUrl: "https://ai.google.dev/docs",
  },
  {
    id: "custom_api",
    label: "Generic API Key",
    description: "Any third-party REST API your app needs.",
    category: "custom",
    categoryLabel: "Custom",
    connectMode: "secrets_form",
    docsUrl: "/help",
    chatPrompt:
      "Wire a secure server-side integration for [SERVICE_NAME]. Store the API key in project secrets and never expose it to the browser.",
  },
];

export function integrationsByCategory(): Map<IntegrationCategoryId, IntegrationCatalogItem[]> {
  const map = new Map<IntegrationCategoryId, IntegrationCatalogItem[]>();
  for (const cat of INTEGRATION_CATEGORIES) {
    map.set(
      cat.id,
      INTEGRATIONS_CATALOG.filter((i) => i.category === cat.id),
    );
  }
  return map;
}
