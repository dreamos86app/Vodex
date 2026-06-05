import type { HelpArticle } from "@/lib/help/cms/types";

const SCREENSHOT = (label: string) =>
  `> **Screenshot:** ${label} _(add image in a future release — placeholder supported)_\n\n`;

const INTEGRATION_CHECKLIST = [
  { id: "account", label: "Provider account created" },
  { id: "credentials", label: "Credentials copied into Vodex" },
  { id: "connected", label: "Connected in app dashboard" },
  { id: "tested", label: "Test connection passed" },
  { id: "live", label: "Verified for production use" },
];

export const INTEGRATION_ARTICLES: HelpArticle[] = [
  {
    slug: "github",
    categorySlug: "integrations",
    legacySlug: "github-integration",
    title: "GitHub Integration",
    description: "Connect your app to GitHub for repo sync, deploy hooks, and version control.",
    category: "Integrations",
    readMinutes: 8,
    difficulty: "beginner",
    officialDocsUrl: "https://docs.github.com/en/authentication",
    relatedSlugs: ["integrations/supabase", "publishing/first-publish"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    keywords: ["GITHUB_TOKEN", "PAT", "repository", "oauth"],
    sections: [
      { id: "overview", title: "Overview" },
      { id: "requirements", title: "Requirements" },
      { id: "steps", title: "Step-by-step" },
      { id: "errors", title: "Common errors" },
    ],
    content: `## Overview

GitHub lets Vodex sync generated code to a repository you own. You can push updates, track changes, and connect CI/CD later.

**Why use it:** Backup your app outside Vodex, collaborate with a team, and deploy via GitHub Actions or Vercel.

## Requirements

| Item | Details |
|------|---------|
| Account | Free [GitHub account](https://github.com/join) |
| Cost | Free for public/private repos (within GitHub limits) |
| Plan | Vodex Starter+ for per-app integrations |

## Setup time

**~5 minutes** if you already have a GitHub account and repository.

## Step-by-step guide

### Step 1: Link your Vodex account to GitHub

1. Open your app **Dashboard → Integrations**.
2. Click **Link GitHub account** (one-time for your Vodex profile).
3. Authorize Vodex on GitHub.

${SCREENSHOT("GitHub OAuth consent screen")}

### Step 2: Connect GitHub to this app

1. On the GitHub integration card, click **Connect**.
2. Vodex uses your linked account — no manual token paste required for quick connect.

### Step 3: Choose repository (optional)

If prompted, select the repo and default branch (usually \`main\`).

### Step 4: Test connection

Click **Test connection** in the integration modal. Status should show **Connected** with a green health indicator.

### Step 5: Verify in dashboard

Return to **Integrations** — badge should read **Connected**. Last test timestamp updates after each test.

## Common errors

| Error | Fix |
|-------|-----|
| \`401 Bad credentials\` | Re-link GitHub account; token may have expired |
| \`Repository not found\` | Confirm repo name and that your account has access |
| \`Resource not accessible\` | PAT needs \`repo\` scope |

## FAQ

**Do I need a Personal Access Token?**  
Quick connect uses OAuth. Manual PAT setup is only for advanced/legacy flows.

**Can I use an organization repo?**  
Yes, if your linked GitHub user has write access.

## Official docs

[GitHub authentication documentation](https://docs.github.com/en/authentication)
`,
  },
  {
    slug: "supabase",
    categorySlug: "integrations",
    legacySlug: "supabase-setup",
    title: "Supabase Integration",
    description: "Connect database, auth, and storage for your published app.",
    category: "Integrations",
    readMinutes: 12,
    difficulty: "beginner",
    officialDocsUrl: "https://supabase.com/docs",
    relatedSlugs: ["authentication/google-login", "integrations/github"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    keywords: ["SUPABASE_URL", "anon key", "service role", "RLS"],
    content: `## Overview

Supabase provides Postgres database, authentication, storage, and realtime for apps you build on Vodex.

**Why use it:** Production-grade backend without managing servers. Works with generated apps and published auth.

## Requirements

| Item | Details |
|------|---------|
| Account | [supabase.com](https://supabase.com) — free tier available |
| Cost | Free tier for development; paid plans for scale |
| Keys needed | Project URL, anon key; service role (server only) optional |

## Setup time

**~10 minutes** for first project.

## Step-by-step guide

### Step 1: Create a Supabase project

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. **New project** → choose org, name, password, region.
3. Wait for provisioning (~2 minutes).

${SCREENSHOT("Supabase new project wizard")}

### Step 2: Find Project URL

**Settings → API → Project URL** — looks like \`https://abcdefgh.supabase.co\`

### Step 3: Find Anon key

Same page: **anon public** key — safe for browser with Row Level Security (RLS).

### Step 4: Connect in Vodex

1. App **Dashboard → Integrations → Supabase**.
2. Use **Connect Supabase** modal (link account or paste URL + keys).
3. Pick your Supabase project from the list.

### Step 5: Test connection

Click **Test connection**. Vodex calls Supabase REST with your anon key.

### Step 6: Verify green status

Integration card shows **Connected**. Run a second test after publish if you changed keys.

## Service role key (optional)

For server-side admin tasks only. **Never** expose in client code or published HTML.

## Row Level Security

Enable RLS on every table in production. Vodex-generated apps include starter policies — review before launch.

## Common errors

| Error | Fix |
|-------|-----|
| Anon key rejected | Copy full key; no extra spaces |
| Permission denied | Check RLS policies |
| OAuth redirect mismatch | See [Google login guide](/help/authentication/google-login) |

## FAQ

**Vodex platform Supabase vs my project?**  
Published apps on Vodex-managed auth use platform Supabase. Your connected project is for **your app's data** when you export or self-host.

## Official docs

[Supabase documentation](https://supabase.com/docs)
`,
  },
  {
    slug: "stripe",
    categorySlug: "integrations",
    title: "Stripe (App Integration)",
    description: "Accept card payments in your app — overview before the full Payments academy.",
    category: "Integrations",
    readMinutes: 6,
    difficulty: "intermediate",
    officialDocsUrl: "https://stripe.com/docs",
    relatedSlugs: ["payments/stripe"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Stripe processes card payments for **your customers** in **your published app**. This is separate from Vodex subscription billing.

**Why use it:** Industry-standard checkout, subscriptions, and webhooks.

## Requirements

Stripe account (free to create). Live charges require business verification.

## Setup time

**~15 minutes** with test keys; longer for live activation.

## Quick steps

1. Create [Stripe account](https://dashboard.stripe.com/register).
2. Copy **test** publishable + secret keys.
3. App **Dashboard → Payments → Stripe** — save keys, mode **test**.
4. **Test connection** and run test checkout.
5. For production guide see [Stripe Payments Academy](/help/payments/stripe).

${SCREENSHOT("Stripe API keys dashboard")}

## Official docs

[Stripe Docs](https://stripe.com/docs)
`,
  },
  {
    slug: "resend",
    categorySlug: "integrations",
    title: "Resend Email",
    description: "Send transactional email from your app.",
    category: "Integrations",
    readMinutes: 7,
    difficulty: "beginner",
    officialDocsUrl: "https://resend.com/docs",
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Resend delivers signup emails, password resets, receipts, and notifications.

## Requirements

[Resend account](https://resend.com). Verify a sending domain for production.

## Setup time

**~8 minutes** (domain verification can take up to 48h).

## Step-by-step

1. Create Resend account → **API Keys** → create key.
2. Vodex **Integrations → Resend** → paste API key.
3. Add verified **from** address in Resend dashboard.
4. Test with mock mode first, then live send from your app.

## Common errors

| Error | Fix |
|-------|-----|
| Domain not verified | Add DNS records Resend provides |
| 403 invalid key | Regenerate API key |

## Official docs

[Resend documentation](https://resend.com/docs)
`,
  },
  {
    slug: "openai",
    categorySlug: "integrations",
    title: "OpenAI",
    description: "Use your own OpenAI API key for app runtime AI features.",
    category: "Integrations",
    readMinutes: 6,
    difficulty: "beginner",
    officialDocsUrl: "https://platform.openai.com/docs",
    relatedSlugs: ["ai-providers/openai"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Bring your OpenAI billing for features inside **your app** (not Vodex build credits).

## Requirements

[OpenAI Platform](https://platform.openai.com) account with payment method for production usage.

## Setup time

**~5 minutes**

## Steps

1. **API keys** → Create secret key (\`sk-...\`).
2. Vodex **Integrations → OpenAI** → save key (encrypted).
3. Test connection (validates key shape; live call if not mock).
4. Set usage limits in OpenAI dashboard to control spend.

## Official docs

[OpenAI API reference](https://platform.openai.com/docs)
`,
  },
  {
    slug: "anthropic",
    categorySlug: "integrations",
    title: "Anthropic (Claude)",
    description: "Connect Claude API for your generated app.",
    category: "Integrations",
    readMinutes: 6,
    difficulty: "beginner",
    officialDocsUrl: "https://docs.anthropic.com",
    relatedSlugs: ["ai-providers/anthropic"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Anthropic Claude powers chat and reasoning features in your app when you supply your own API key.

## Requirements

[Anthropic Console](https://console.anthropic.com) account.

## Setup time

**~5 minutes**

## Steps

1. Create API key in Anthropic Console.
2. Save in Vodex **Integrations → Anthropic**.
3. Test connection.
4. Monitor usage in Anthropic billing.

## Official docs

[Anthropic documentation](https://docs.anthropic.com)
`,
  },
  {
    slug: "gemini",
    categorySlug: "integrations",
    title: "Google Gemini",
    description: "Connect Gemini models via Google AI Studio.",
    category: "Integrations",
    readMinutes: 6,
    difficulty: "beginner",
    officialDocsUrl: "https://ai.google.dev/docs",
    relatedSlugs: ["ai-providers/gemini"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Gemini provides multimodal AI (text, image) for apps you publish.

## Requirements

Google account + [Google AI Studio](https://aistudio.google.com) API key.

## Setup time

**~5 minutes**

## Steps

1. Get API key from AI Studio.
2. Vodex **Integrations → Gemini** → save as \`GOOGLE_GENERATIVE_AI_API_KEY\`.
3. Test connection.
4. Set quotas in Google Cloud if moving to production billing.

## Official docs

[Gemini API docs](https://ai.google.dev/docs)
`,
  },
  {
    slug: "firebase",
    categorySlug: "integrations",
    title: "Firebase",
    description: "Firebase Auth, Firestore, and push — service account setup.",
    category: "Integrations",
    readMinutes: 10,
    difficulty: "intermediate",
    officialDocsUrl: "https://firebase.google.com/docs",
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Firebase offers auth, Firestore, Cloud Messaging, and more for mobile-first apps.

## Requirements

[Firebase project](https://console.firebase.google.com). Service account JSON for server SDK.

## Setup time

**~15 minutes**

## Steps

1. Create Firebase project.
2. **Project settings → Service accounts → Generate new private key**.
3. Paste full JSON into Vodex (encrypted) as \`FIREBASE_SERVICE_ACCOUNT_JSON\`.
4. Test connection.
5. Never commit service account JSON to git.

${SCREENSHOT("Firebase service account download")}

## Official docs

[Firebase documentation](https://firebase.google.com/docs)
`,
  },
  {
    slug: "paypal",
    categorySlug: "integrations",
    title: "PayPal (Overview)",
    description: "PayPal checkout integration overview.",
    category: "Integrations",
    readMinutes: 5,
    difficulty: "intermediate",
    officialDocsUrl: "https://developer.paypal.com/docs",
    relatedSlugs: ["payments/paypal"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

PayPal lets customers pay with PayPal balance or linked cards.

See full [PayPal Payments Academy](/help/payments/paypal) for sandbox, webhooks, and launch checklist.

## Setup time

**~12 minutes** with sandbox credentials.
`,
  },
  {
    slug: "paddle",
    categorySlug: "integrations",
    title: "Paddle (Overview)",
    description: "Paddle Billing for your app — not Vodex platform billing.",
    category: "Integrations",
    readMinutes: 5,
    difficulty: "intermediate",
    officialDocsUrl: "https://developer.paddle.com",
    relatedSlugs: ["payments/paddle"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

**Your app's Paddle** handles customer checkout. **Vodex's Paddle** bills your Vodex subscription — keep them separate.

Full guide: [Paddle Payments Academy](/help/payments/paddle).
`,
  },
  {
    slug: "lemon-squeezy",
    categorySlug: "integrations",
    title: "Lemon Squeezy (Overview)",
    description: "Digital products and subscriptions via Lemon Squeezy.",
    category: "Integrations",
    readMinutes: 5,
    difficulty: "beginner",
    officialDocsUrl: "https://docs.lemonsqueezy.com",
    relatedSlugs: ["payments/lemon-squeezy"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

Lemon Squeezy handles tax, checkout, and licenses for digital goods.

Full guide: [Lemon Squeezy Payments Academy](/help/payments/lemon-squeezy).
`,
  },
  {
    slug: "revenuecat",
    categorySlug: "integrations",
    title: "RevenueCat (Overview)",
    description: "Mobile subscriptions and entitlements.",
    category: "Integrations",
    readMinutes: 5,
    difficulty: "intermediate",
    officialDocsUrl: "https://www.revenuecat.com/docs",
    relatedSlugs: ["payments/revenuecat", "mobile-apps/android-publishing"],
    checklist: INTEGRATION_CHECKLIST,
    lastUpdated: "2026-05-19",
    content: `## Overview

RevenueCat syncs App Store and Play Store purchases to your backend.

Full guide: [RevenueCat Payments Academy](/help/payments/revenuecat).
`,
  },
];
