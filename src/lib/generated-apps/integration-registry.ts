export type IntegrationField = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  guide: string;
};

export type IntegrationProviderDef = {
  id: string;
  label: string;
  description: string;
  secretKeys: string[];
  fields: IntegrationField[];
};

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  {
    id: "supabase",
    label: "Supabase",
    description: "Database and auth for your generated app.",
    secretKeys: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    fields: [
      { key: "SUPABASE_URL", label: "Project URL", required: true, guide: "Supabase → Project Settings → API → Project URL" },
      { key: "SUPABASE_ANON_KEY", label: "Anon key", secret: true, required: true, guide: "API → anon public key (safe for client with RLS)" },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Service role key",
        secret: true,
        guide: "API → service_role — server-only, never expose to browser",
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Repo sync and deploy hooks.",
    secretKeys: ["GITHUB_TOKEN"],
    fields: [
      { key: "GITHUB_TOKEN", label: "Personal access token", secret: true, required: true, guide: "GitHub → Settings → Developer settings → PAT with repo scope" },
      { key: "GITHUB_REPO_OWNER", label: "Repo owner", guide: "Username or org that owns the repository" },
      { key: "GITHUB_REPO_NAME", label: "Repo name", guide: "Repository name without owner prefix" },
      { key: "GITHUB_BRANCH", label: "Branch", placeholder: "main", guide: "Default branch to sync" },
    ],
  },
  {
    id: "resend",
    label: "Resend",
    description: "Transactional email from your app.",
    secretKeys: ["RESEND_API_KEY"],
    fields: [
      { key: "RESEND_API_KEY", label: "API key", secret: true, required: true, guide: "Resend dashboard → API Keys" },
      { key: "RESEND_FROM_EMAIL", label: "From email", guide: "Verified sender domain in Resend" },
    ],
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Payments and checkout.",
    secretKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    fields: [
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable key", guide: "Stripe Dashboard → Developers → API keys" },
      { key: "STRIPE_SECRET_KEY", label: "Secret key", secret: true, required: true, guide: "Use test keys until live" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook secret", secret: true, guide: "Webhooks → signing secret" },
    ],
  },
  {
    id: "paddle",
    label: "Paddle",
    description: "Paddle Billing checkout.",
    secretKeys: ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"],
    fields: [
      { key: "PADDLE_API_KEY", label: "API key", secret: true, required: true, guide: "Paddle → Developer tools → Authentication" },
      { key: "PADDLE_WEBHOOK_SECRET", label: "Webhook secret", secret: true, guide: "Notification settings" },
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "PayPal checkout.",
    secretKeys: ["PAYPAL_CLIENT_SECRET"],
    fields: [
      { key: "PAYPAL_CLIENT_ID", label: "Client ID", guide: "PayPal Developer → Apps" },
      { key: "PAYPAL_CLIENT_SECRET", label: "Client secret", secret: true, required: true, guide: "Sandbox vs live credentials" },
    ],
  },
  {
    id: "lemonsqueezy",
    label: "Lemon Squeezy",
    description: "Digital sales and subscriptions.",
    secretKeys: ["LEMON_SQUEEZY_API_KEY"],
    fields: [
      { key: "LEMON_SQUEEZY_API_KEY", label: "API key", secret: true, required: true, guide: "Settings → API" },
      { key: "LEMON_SQUEEZY_STORE_ID", label: "Store ID", guide: "Store settings URL segment" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Your own OpenAI billing (skips Vodex Action Credits when configured).",
    secretKeys: ["OPENAI_API_KEY"],
    fields: [
      { key: "OPENAI_API_KEY", label: "API key", secret: true, required: true, guide: "platform.openai.com → API keys" },
      { key: "OPENAI_MODEL", label: "Default model", placeholder: "gpt-4o-mini", guide: "Optional model override" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude API for your app.",
    secretKeys: ["ANTHROPIC_API_KEY"],
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API key", secret: true, required: true, guide: "console.anthropic.com → API keys" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini models in your app.",
    secretKeys: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
    fields: [
      {
        key: "GOOGLE_GENERATIVE_AI_API_KEY",
        label: "API key",
        secret: true,
        required: true,
        guide: "Google AI Studio → Get API key",
      },
    ],
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Deploy previews and production.",
    secretKeys: ["VERCEL_TOKEN"],
    fields: [
      { key: "VERCEL_TOKEN", label: "Access token", secret: true, required: true, guide: "Vercel → Account → Tokens" },
    ],
  },
  {
    id: "firebase",
    label: "Firebase",
    description: "Firebase Auth / Firestore.",
    secretKeys: ["FIREBASE_SERVICE_ACCOUNT_JSON"],
    fields: [
      {
        key: "FIREBASE_SERVICE_ACCOUNT_JSON",
        label: "Service account JSON",
        secret: true,
        required: true,
        guide: "Firebase console → Project settings → Service accounts",
      },
    ],
  },
  {
    id: "discord",
    label: "Discord webhook",
    description: "Post notifications to Discord.",
    secretKeys: ["DISCORD_WEBHOOK_URL"],
    fields: [
      { key: "DISCORD_WEBHOOK_URL", label: "Webhook URL", secret: true, required: true, guide: "Channel → Integrations → Webhooks" },
    ],
  },
  {
    id: "generic",
    label: "Generic API key",
    description: "Custom provider secret.",
    secretKeys: [],
    fields: [
      { key: "CUSTOM_API_KEY", label: "API key name", required: true, guide: "Use UPPER_SNAKE_CASE key names" },
      { key: "CUSTOM_API_VALUE", label: "API key value", secret: true, required: true, guide: "Stored encrypted — never shown again" },
    ],
  },
];

export function getIntegrationProvider(id: string): IntegrationProviderDef | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}
