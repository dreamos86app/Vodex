import { buildPlanCreditsMarkdownTable } from "@/lib/docs/plan-credits-doc-table";

const PLAN_CREDITS_TABLE = buildPlanCreditsMarkdownTable();

/**
 * Vodex Help Center — article registry
 *
 * Each article has:
 *  - slug: URL path segment
 *  - title, description, category, readMinutes
 *  - content: MDX-style markdown (rendered as-is with prose styles)
 */

export interface DocArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  /** Extra terms for Help Center search (errors, provider names, env keys). */
  keywords?: string[];
  content: string;
}

export const DOCS: DocArticle[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Create your first app with Vodex in under five minutes.",
    category: "Getting Started",
    readMinutes: 3,
    content: `## What is Vodex?

Vodex is an AI-native app creation platform. Describe what you want to build, and the AI generates a complete, deployable codebase — frontend, backend, database, auth, and billing included.

## Create your first app

1. Open the **Create** page (the home screen).
2. Type a description of your app in the prompt box. Be specific — the more detail you provide, the better the result.
3. Click **Create** or press \`⌘ Enter\`.
4. Vodex generates your project and opens it in the workspace.

## Workspace overview

Your workspace contains:

- **Chat** — talk to the AI to modify your app
- **Projects** — all your apps
- **Deploy** — deploy and manage live environments
- **Settings** — billing, API keys, integrations

## Next steps

- [How AI Chat Works](/help/docs/how-ai-chat-works)
- [Setting up Supabase](/help/docs/supabase-setup)
- [Publishing to the Play Store](/help/docs/play-store-setup)
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "how-ai-chat-works",
    title: "How AI Chat Works",
    description: "Understand the AI modes, context window, and how to get the best results.",
    category: "AI Modes",
    readMinutes: 5,
    content: `## AI modes

Vodex runs in four modes, each with different capabilities and costs:

| Mode | What it does | Cost |
|------|-------------|------|
| **Discuss** | Answers questions, explains code, suggests approaches | Low |
| **Edit** | Makes targeted edits to specific files | Medium |
| **Agent** | Autonomously completes multi-step tasks | High |
| **Build** | Compiles, deploys, and publishes | High |

Switch modes with the mode selector in the chat input bar.

## Discuss mode

Discuss mode is best for:
- Understanding existing code
- Planning features before building
- Getting explanations of errors
- Exploring options without committing

Discuss mode never modifies your files. It uses a cheaper model with a lighter context, which keeps costs low.

## Edit mode

Edit mode makes targeted changes. Use it when you know exactly what to change:

> "Update the login button style to match the accent color"
> "Add email validation to the signup form"

## Agent mode

Agent mode is fully autonomous. The AI reads your codebase, plans a sequence of changes, and executes them in order. Use it for:

> "Add a complete password reset flow"
> "Integrate Stripe subscriptions with webhook handling"

Agent mode requires the most credits but handles the most complex tasks.

## Context window

The AI automatically includes relevant files in its context window. You can pin specific files by clicking the paperclip icon in the chat input. The context indicator shows how many tokens are in use.

## Tips for better results

- **Be specific.** Instead of "make it better," say "reduce the gap between the logo and the nav by 8px."
- **Include the why.** "Add loading states — the button freezes when the API is slow" gives better results than "add a spinner."
- **Use Discuss first.** Before asking Agent to implement something complex, ask in Discuss mode to confirm the plan.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "supabase-setup",
    title: "Supabase Setup",
    description: "Connect your generated app to your own Supabase project — auth, database, and redirect URLs.",
    category: "Integrations",
    readMinutes: 7,
    keywords: [
      "Supabase callback",
      "provider not enabled",
      "redirect URL",
      "YOUR_SUPABASE_PROJECT",
      "auth/v1/callback",
    ],
    content: `## Prerequisites

- A [Supabase account](https://supabase.com)
- A Supabase project (free tier works)

## Step 1: Get your credentials

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Settings → API**
3. Copy:
   - **Project URL** (looks like \`https://xyzabc.supabase.co\`)
   - **Anon key** (also called "publishable key")

## Step 2: Add to Vodex

Open **Settings → Integrations** and paste both values. Or add them directly to your project's environment variables:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
\`\`\`

## Step 3: Configure redirect URLs (generated app)

Use **your generated app’s public URL**, not the Vodex platform login domain.

| Context | Redirect URL |
|---------|----------------|
| Local dev | \`http://localhost:3000/auth/callback\` |
| Published subdomain | \`https://APP_SLUG.vodex.app/auth/callback\` (when wildcard DNS is enabled) |
| Path publish mode | \`https://YOUR_APP_DOMAIN/p/APP_SLUG\` — set \`NEXT_PUBLIC_APP_URL\` to \`YOUR_APP_DOMAIN\` and add \`https://YOUR_APP_DOMAIN/auth/callback\` |
| Custom domain | \`https://YOUR_CUSTOM_DOMAIN/auth/callback\` |

In Supabase: **Auth → URL Configuration → Redirect URLs**, add every URL you use (local + production).

**Supabase provider callback (Google/GitHub dashboards):** always use  
\`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`  
— never your app URL in the Google/GitHub “authorized redirect” field.

**Vodex platform login only:** if you are configuring sign-in to **vodex.dev** itself, add \`https://vodex.dev/auth/callback\`. That does **not** apply to apps you publish from Vodex.

## Row Level Security (RLS)

Supabase uses RLS to secure your tables. Every generated project enables RLS by default. The AI generates appropriate policies, but you should review them:

- **Auth policies**: Users can only read/write their own data
- **Public tables**: Explicitly marked as world-readable
- **Admin routes**: Protected by \`is_admin\` flag on the \`profiles\` table

## Database types

When you modify your schema, regenerate the TypeScript types:

\`\`\`bash
npx supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts
\`\`\`

## Troubleshooting

**"Your project's URL and API key are required"**
→ Check that \`NEXT_PUBLIC_SUPABASE_URL\` and \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` are set in your \`.env.local\` file.

**"User not found" after login**
→ Make sure your \`profiles\` table has a trigger on \`auth.users\` to create profiles on signup.

**OAuth not working**
→ Enable the provider in Supabase → **Auth → Providers**, and add the callback URL to the provider's allowed redirect URIs.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "play-store-setup",
    title: "Play Store Setup",
    description: "Publish your Vodex app to the Google Play Store.",
    category: "Mobile Publishing",
    readMinutes: 10,
    content: `## Overview

Vodex supports publishing web apps to the Play Store using **Trusted Web Activities (TWA)** via Capacitor. The flow is:

1. Build your web app
2. Wrap it in a TWA shell
3. Generate a signed APK/AAB
4. Upload to Play Console

## Step 1: Configure your package ID

Your app's package ID must be unique (e.g. \`com.yourcompany.yourapp\`). Set it in your project settings:

\`\`\`
Settings → Mobile → Package ID
\`\`\`

## Step 2: Generate your SHA256 fingerprints

You need **three fingerprints** for full Play Store compatibility:

| Type | Use |
|------|-----|
| Upload key SHA256 | Signs your APK for Play Console upload |
| Play App Signing SHA256 | Google re-signs your app for distribution |
| Debug SHA256 | For local testing with Firebase |

To get your Play App Signing fingerprint:
1. Play Console → Your app → Release → Setup → App signing
2. Copy the SHA256 certificate fingerprint

Add all three to **Settings → Mobile → SHA256 Fingerprints**.

## Step 3: Configure TWA manifest

The TWA manifest links your Android app to your web domain. Add to \`assetlinks.json\`:

\`\`\`json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.yourapp",
    "sha256_cert_fingerprints": [
      "YOUR_PLAY_APP_SIGNING_SHA256",
      "YOUR_UPLOAD_KEY_SHA256"
    ]
  }
}]
\`\`\`

Host this at \`https://YOUR_CUSTOM_DOMAIN/.well-known/assetlinks.json\` (use your published app domain).

## Step 4: Build and upload

From the **Deploy** tab:
1. Select your project
2. Click **Build for Android**
3. Download the AAB file
4. Upload to Play Console → Production

## Troubleshooting

**"Digital Asset Links verification failed"**
→ Check that \`/.well-known/assetlinks.json\` is publicly accessible and contains the correct SHA256.

**App shows as browser, not TWA**
→ Asset links file is missing or has wrong fingerprints. Check all three SHA256 values.

**"Package name already taken"**
→ Choose a different package ID. Once published, it cannot be changed.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "zip-import",
    title: "ZIP Import & Project Restoration",
    description: "Import an existing project ZIP and restore it inside Vodex.",
    category: "ZIP Imports",
    readMinutes: 6,
    content: `## What ZIP import does

ZIP import lets you bring an existing codebase into Vodex. The import pipeline:

1. **Uploads** your ZIP
2. **Extracts** the archive
3. **Detects** frameworks, integrations, and config files
4. **Reconstructs** the project model
5. **Opens** the workspace

## Supported project types

| Framework | Detection |
|-----------|-----------|
| Next.js | \`next.config.js/ts\` |
| React / Vite | \`vite.config.ts\` |
| Expo | \`app.json\` with \`expo\` key |
| Capacitor | \`capacitor.config.ts\` |
| TWA | \`twa-manifest.json\` |

## Supported integrations detected

- Supabase (\`@supabase/supabase-js\`, \`@supabase/ssr\`)
- Firebase (\`firebase\` package, \`firebase.json\`)
- Stripe (\`stripe\`, \`@stripe/stripe-js\`)
- Prisma (\`schema.prisma\`)
- Tailwind (\`tailwind.config.*\`)

## How to import

1. Go to **Projects → Import ZIP**
2. Upload your ZIP file (max 100MB)
3. Watch the detection pipeline run
4. Review the detected technologies
5. Click **Open in Workspace**

## What gets restored

✅ Source files and directory structure
✅ \`package.json\` and dependencies list
✅ Environment variable names (not values — add secrets manually)
✅ Framework configuration
✅ Route structure
✅ Integration configuration

⚠️ Not restored:
- Secret values (API keys, passwords)
- Database contents
- Deployment history

## After import

Once imported, you can use the AI to continue building:

> "This is an existing Next.js app. Add a Stripe subscription page."
> "Review this codebase and suggest improvements to the auth flow."

## Troubleshooting

**"Framework not detected"**
→ Make sure your ZIP includes the root config files (\`package.json\`, \`next.config.ts\`, etc.) at the top level, not inside a subdirectory.

**"ZIP too large"**
→ Exclude \`node_modules\` and \`.next\` from your ZIP. Only source files are needed.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "environment-variables",
    title: "Environment Variables",
    description: "Manage secrets and configuration across local, preview, and production environments.",
    category: "Configuration",
    readMinutes: 4,
    keywords: ["NEXT_PUBLIC_APP_URL", "YOUR_APP_DOMAIN", "webhook URL", "STRIPE_WEBHOOK_SECRET"],
    content: `## How environment variables work

Vodex projects use standard Next.js environment variables:

- **\`NEXT_PUBLIC_\` prefix**: Exposed to the browser and server. Safe for non-secret config like Supabase URL.
- **No prefix**: Server-only. Never sent to the browser. Use for API keys and secrets.

## Required variables

Every Vodex project needs these:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App URL — your generated app's public origin (not vodex.dev unless you own that deployment)
NEXT_PUBLIC_APP_URL=https://YOUR_APP_DOMAIN
\`\`\`

## Common optional variables

\`\`\`env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# AI providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Email
RESEND_API_KEY=re_...
\`\`\`

## Local development

Create a \`.env.local\` file in your project root. This file is git-ignored by default.

## Production

Set environment variables in your deployment platform (Vercel, Railway, Fly.io) under your project's environment settings.

## NEXT_PUBLIC_APP_URL

This is required for correct OAuth redirects, Stripe webhooks, and email links in production. Set it to the URL users actually visit:

\`\`\`env
# Published subdomain example
NEXT_PUBLIC_APP_URL=https://APP_SLUG.vodex.app
# Or your custom domain
NEXT_PUBLIC_APP_URL=https://YOUR_CUSTOM_DOMAIN
\`\`\`

Use **your generated app URL** unless you connected a custom domain — then use \`YOUR_CUSTOM_DOMAIN\`. Do not set this to \`https://vodex.dev\` for a generated app.

Without this, redirects fall back to \`window.location.origin\`, which can misbehave behind proxies or CDNs.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "billing-credits",
    title: "Billing & Credits",
    description: "How Vodex credits work, plan limits, and how to manage your subscription.",
    category: "Billing",
    readMinutes: 4,
    content: `## How credits work

Credits are consumed when you run AI actions. Different modes use different amounts:

| Mode | Credits per action |
|------|-------------------|
| Discuss | ~2 credits |
| Edit | ~10 credits |
| Agent | ~50–200 credits |
| Build | ~100–300 credits |

The exact cost depends on the model used and the length of the context.

## Plans

| Plan | Monthly credits | Price |
|------|----------------|-------|
| Free | 100 | $0 |
| Starter | 1,000 | $9/mo |
| Pro | 10,000 | $29/mo |
| Team | 50,000 | $99/mo |

## Checking your balance

Your credit balance is always visible in the top bar. Click it to see usage history and top up.

## Auto top-up

Enable auto top-up in **Settings → Billing** to automatically purchase credits when your balance drops below a threshold.

## Plan management

- Upgrade or downgrade any time from **Settings → Billing**
- Credits reset at the start of each billing cycle
- Unused credits do not roll over (except on annual plans)

## Viewing usage

**Settings → Billing → Usage** shows:
- Credits consumed per day
- Breakdown by mode (Discuss/Edit/Agent/Build)
- Cost per project

## Enterprise

For teams needing custom limits, SSO, or invoicing, contact sales.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "github-integration",
    title: "GitHub Integration",
    description: "Connect GitHub to enable version control, PR-based deployments, and code sync.",
    category: "Integrations",
    readMinutes: 5,
    content: `## What the GitHub integration does

- Push generated code to a repository
- Create pull requests for AI-generated changes
- Trigger deployments on merge
- Sync code between Vodex and your local environment

## Connecting GitHub

1. Go to **Settings → Integrations → GitHub**
2. Click **Connect**
3. Authorise Vodex on GitHub (OAuth flow)
4. Select which repositories to grant access to

## Pushing to a repository

Once connected, every project can be linked to a GitHub repository:

1. Open your project → **Settings**
2. Under **Version Control**, select or create a repository
3. Click **Push to GitHub**

## Pull requests

When Agent mode makes significant changes, it can create a pull request for review instead of pushing directly to main. Enable this in project settings:

\`\`\`
Project Settings → Version Control → Create PRs for agent changes
\`\`\`

## Local development

Clone your generated project to work locally:

\`\`\`bash
git clone https://github.com/yourorg/your-project.git
cd your-project
npm install
cp .env.local.example .env.local
# Fill in your .env.local values
npm run dev
\`\`\`

## Disconnecting

**Settings → Integrations → GitHub → Disconnect**

This removes Vodex's access to your repositories. Existing code is unaffected.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "how-credits-work",
    title: "How Credits Work",
    description: "Understand how Vodex credits are calculated, why different actions cost different amounts, and how to use them efficiently.",
    category: "Billing",
    readMinutes: 5,
    keywords: ["Build Credits", "Action Credits", "why did a build use credits"],
    content: `## Two credit types

Vodex uses two separate credit pools so building and live app actions stay predictable:

### Build Credits

Used for everything inside Vodex while you design and ship apps:

- **Discuss** mode — planning, Q&A, brainstorming
- **Create** page AI help
- **Build** generation and compilation
- **Edit / fix / update** work on your app

Build Credits = for building inside Vodex.

### Action Credits

Used when your live or generated apps perform runtime actions:

- Runtime AI calls
- Email sending
- Image generation
- Automations and workflows
- File processing and similar app actions

Action Credits = for actions performed by live/generated apps.

Each pool has its own **monthly allowance**, **bonus credits** (when granted), and **reset date** on your plan.

---

## What are credits?

Credits are Vodex's unit of AI and platform usage. Your plan includes a monthly allowance for each pool. Bonus credits appear when your balance exceeds the plan allowance (for example after a top-up or admin grant).

## Why do different actions cost different amounts?

Every AI action involves one or more underlying operations — sending your prompt to a model, receiving a response, running tools, accessing files, or executing builds. Each of these has a cost.

Vodex translates these internal costs into clean, predictable credit amounts so you always know roughly what an action will cost before you run it.

### Models vary in capability and cost

A more powerful model (like Claude Opus or GPT-4.5) produces higher-quality results but requires more compute. A faster, lighter model (like Claude Haiku or Gemini Flash) is cheaper per message but less capable on complex tasks.

| Model tier | Relative cost |
|---|---|
| Lightweight (e.g. Haiku, Gemini Flash) | Low |
| Standard (e.g. Sonnet, GPT-4o) | Medium |
| Premium (e.g. Opus, GPT-4.5) | High |

You can always switch models in the chat input bar.

### Modes affect Build Credit cost

Vodex has four modes — **Discuss**, **Edit**, **Agent**, and **Build** — each with different capabilities and costs.

| Mode | What it does | Relative cost |
|---|---|---|
| Discuss | Answers questions, explains, brainstorms. No file changes. | Lowest |
| Edit | Makes targeted code edits to specific files. | Medium |
| Agent | Autonomously completes multi-step tasks. | High |
| Build | Compiles, deploys, and publishes your app. | Highest |

**Discuss mode** is the most cost-efficient. If you're planning features, reviewing code, or exploring options — use Discuss mode to conserve Build Credits.

**Build mode** is the most expensive because it runs real compilation and deployment pipelines, not just inference.

## How credit costs are calculated

When you take an action, Vodex measures:

1. **Tokens processed** — how much text was sent to the model and returned
2. **Tools used** — file reads, web searches, code execution
3. **Mode overhead** — orchestration work required for the selected mode
4. **Infrastructure** — routing, caching, storage, reliability systems

These are combined into a single credit total, rounded to a clean whole number.

## Monthly allowance, bonus, and reset

- **Monthly allowance** — included with your plan each billing cycle
- **Bonus credits** — extra balance above your allowance (shown as \`+X bonus\` in the tracker)
- **Reset date** — both pools refresh on your plan renewal date

Your renewal date is exactly one billing cycle after your subscription started (e.g., if you subscribed on May 16, your credits refresh every June 16, July 16, etc.).

## How to reduce your credit usage

- **Use Discuss mode for planning.** Don't use Agent mode to answer a question you could ask in Discuss.
- **Use lighter models for simple tasks.** Claude Haiku and Gemini Flash handle most everyday coding questions well.
- **Be specific in your prompts.** Shorter, clearer prompts use fewer tokens.
- **Avoid re-running agents on already-solved problems.** If an agent already solved something, reference the output rather than running again.

## What happens when I run out of credits?

When a pool reaches zero, related actions are paused. You can:

- **Upgrade your plan** to get more monthly credits at a lower per-credit rate
- **Purchase a credit top-up** for additional credits without changing your plan
- **Wait for your monthly reset** — credits refresh automatically on your renewal date

## Do unused credits carry over?

Monthly plan credits reset each billing cycle. They do not roll over.

If you upgrade your plan, you pay the **full new plan price today** (no prorated upgrade charge). Your billing cycle restarts and you receive the **full** Build Credit and Action Credit allowance for the new plan — unused monthly allowance from the previous plan does not stack. Purchased credit packs and explicit bonus grants stay separate.

${PLAN_CREDITS_TABLE}

## Credit packs

Credit packs let you purchase additional Build Credits that never expire, separately from your plan. They're charged once and available until consumed. Packs are useful for one-time large projects (like migrating an existing app or running a complex build pipeline).

## Questions?

If you believe credits were charged incorrectly, contact support with the conversation ID. We can review exact token counts and usage logs.

See also: [Policies & Legal](/help/docs/policies) · [Refund Policy](/refunds).
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "oauth-setup",
    title: "Google & GitHub OAuth Setup",
    description: "Separate Vodex platform login from OAuth for apps you build — correct callback URLs for each.",
    category: "Integrations",
    readMinutes: 8,
    keywords: [
      "redirect_uri_mismatch",
      "redirect URI mismatch",
      "callback_failed",
      "custom domain OAuth",
      "Google OAuth",
      "GitHub OAuth",
      "YOUR_APP_DOMAIN",
      "YOUR_CUSTOM_DOMAIN",
      "APP_SLUG",
    ],
    content: `## Two different OAuth setups

Do **not** mix these up:

| Purpose | Site URL / homepage | App redirect (Supabase → your app) | Provider callback (Google/GitHub → Supabase) |
|---------|---------------------|-------------------------------------|-----------------------------------------------|
| **Vodex platform login** | \`https://vodex.dev\` | \`https://vodex.dev/auth/callback\` | \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\` |
| **Generated app you built** | \`https://YOUR_APP_DOMAIN\` or \`https://APP_SLUG.vodex.app\` | \`https://YOUR_APP_DOMAIN/auth/callback\` (or custom domain) | Same Supabase \`/auth/v1/callback\` on **your** project |

**Rule:** For apps created inside Vodex, use **your generated app URL** unless you connected a **custom domain** — then use that domain everywhere (OAuth, payments, webhooks).

---

## Generated app — Google OAuth

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services → Credentials → Create OAuth client ID → Web application**
3. **Authorized redirect URIs** — add **only** the Supabase callback:
   - \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`

Do **not** put \`vodex.dev\` here unless you are configuring platform login, not your generated app.

### 2. Supabase (your project)

1. **Auth → Providers → Google** — enable, paste Client ID + Secret
2. **Auth → URL Configuration → Redirect URLs** — add every app URL users will land on after login:
   - Local: \`http://localhost:3000/auth/callback\`
   - Published: \`https://APP_SLUG.vodex.app/auth/callback\` (subdomain mode) **or** \`https://YOUR_APP_DOMAIN/auth/callback\`
   - Custom domain: \`https://YOUR_CUSTOM_DOMAIN/auth/callback\`

Set \`NEXT_PUBLIC_APP_URL\` in the generated app to match production (see [Environment variables](/help/docs/environment-variables)).

---

## Generated app — GitHub OAuth

1. [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps → New**
2. **Homepage URL:** \`https://YOUR_APP_DOMAIN\` (or your custom domain / published subdomain URL)
3. **Authorization callback URL:** \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`
4. Enable GitHub in Supabase and add the same **Redirect URLs** list as Google above.

---

## Vodex platform login only

If you are signing into **Vodex itself** (the builder), add to Supabase redirect URLs:

- \`https://vodex.dev/auth/callback\`

Local platform development may also use \`http://localhost:3000/auth/callback\` when running the platform locally.

---

## Local development (generated app)

1. \`http://localhost:3000/auth/callback\` in Supabase redirect URLs
2. \`NEXT_PUBLIC_APP_URL=http://localhost:3000\` in \`.env.local\`
3. Google Cloud redirect URI remains the Supabase \`/auth/v1/callback\` URL only

---

## Troubleshooting

**redirect_uri_mismatch**
→ Google/GitHub is comparing against the Supabase callback URL. Fix the **Authorization callback** in the provider dashboard, not \`vodex.dev\`, unless you are configuring platform login.

**Provider not enabled**
→ Enable the provider under Supabase **Auth → Providers**.

**callback_failed**
→ Check SSL locally, \`NEXT_PUBLIC_APP_URL\`, and that the app route \`/auth/callback\` exists in your generated project.

**Works locally but not after publish**
→ Add your **published** app URL and custom domain to Supabase redirect URLs; update \`NEXT_PUBLIC_APP_URL\` in production env vars.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "deployment",
    title: "Deploying Your App",
    description: "Deploy your generated app to production with Vercel, custom domains, and environment management.",
    category: "Deployment",
    readMinutes: 6,
    keywords: ["publish", "YOUR_APP_DOMAIN", "custom domain", "webhook URL", "APP_SLUG"],
    content: `## Overview

Vodex generates production-ready Next.js apps. Deployment targets:

| Platform | Notes |
|----------|-------|
| **Vercel** | Recommended. Zero-config, instant deploys |
| **Railway** | Great for full-stack with databases |
| **Fly.io** | Best for global edge deployments |
| **Self-hosted** | Any Node.js-capable server |

---

## Deploying to Vercel

### 1. Connect your repository

1. Push your project to GitHub via **Settings → Integrations → GitHub**
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository

### 2. Set environment variables

In Vercel project settings → **Environment Variables**, add all variables from your \`.env.local.example\`:

\`\`\`
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=https://YOUR_APP_DOMAIN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ANTHROPIC_API_KEY
\`\`\`

### 3. Set NEXT_PUBLIC_APP_URL

Critical for OAuth, webhooks, and email links on **your generated app**:
\`\`\`
NEXT_PUBLIC_APP_URL=https://APP_SLUG.vodex.app
# or
NEXT_PUBLIC_APP_URL=https://YOUR_CUSTOM_DOMAIN
\`\`\`

### 4. Update Supabase redirect URLs

Add every production URL users hit to **Supabase → Auth → URL Configuration → Redirect URLs**:
\`\`\`
https://YOUR_APP_DOMAIN/auth/callback
https://YOUR_CUSTOM_DOMAIN/auth/callback
\`\`\`

Also add payment provider webhook URLs using the same domain (see [Payments setup](/help/docs/payments-providers)).

---

## Custom domains

See [Custom domains for generated apps](/help/docs/custom-domains) for DNS, OAuth, and webhook updates when you connect \`YOUR_CUSTOM_DOMAIN\`.

---

## Deployment environments

Vodex supports three environments:

| Environment | Branch | Purpose |
|-------------|--------|---------|
| **Production** | \`main\` | Live site |
| **Preview** | Any PR | PR preview URLs |
| **Staging** | \`staging\` | Pre-release testing |

---

## Rollbacks

To roll back to a previous deployment:
1. **Vodex → Deploy → Deployment History**
2. Find the deployment you want to restore
3. Click **Rollback**

This triggers a re-deployment of the selected build.

---

## Troubleshooting

**Build failing after deploy**
→ Check that all required environment variables are set in Vercel. The most common cause is missing \`NEXT_PUBLIC_SUPABASE_URL\`.

**OAuth not working in production**
→ Update \`NEXT_PUBLIC_APP_URL\` to your production domain and add the domain to Supabase's allowed redirect list.

**Webhook not firing**
→ Set the webhook endpoint in Stripe Dashboard to your production URL, and update \`STRIPE_WEBHOOK_SECRET\` with the production signing secret.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "custom-domains",
    title: "Custom Domains",
    description: "Connect YOUR_CUSTOM_DOMAIN to a published app and update OAuth, payments, and webhooks.",
    category: "Deployment",
    readMinutes: 5,
    keywords: ["custom domain OAuth", "YOUR_CUSTOM_DOMAIN", "webhook URL", "DNS"],
    content: `## Overview

When you connect a custom domain to a **generated app**, every external integration must use that domain — not \`vodex.dev\` and not a placeholder.

## DNS

1. Publish the app from Vodex (you receive \`APP_SLUG\` / subdomain or path URL).
2. In your host (Vercel, etc.), add \`YOUR_CUSTOM_DOMAIN\`.
3. Point DNS (CNAME or A record) per your host’s instructions.

## OAuth after custom domain

In **your Supabase project** → **Auth → URL Configuration → Redirect URLs**, add:

\`\`\`
https://YOUR_CUSTOM_DOMAIN/auth/callback
\`\`\`

Keep \`http://localhost:3000/auth/callback\` for local dev.

Google/GitHub **Authorization callback URL** stays:

\`\`\`
https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
\`\`\`

Set in the generated app:

\`\`\`env
NEXT_PUBLIC_APP_URL=https://YOUR_CUSTOM_DOMAIN
\`\`\`

## Payments & webhooks

Stripe (and similar) webhook endpoints must use the same public origin, for example:

\`\`\`
https://YOUR_CUSTOM_DOMAIN/api/webhooks/stripe
\`\`\`

Update signing secrets in production env vars after changing domains.

## What Vodex does vs you

| Vodex | You |
|-----------|-----|
| Generates app code with \`/auth/callback\` routes | Own Supabase project & provider dashboards |
| Publish + subdomain (\`APP_SLUG.vodex.app\`) when enabled | DNS for custom domain |
| Connection UI in Settings | Provider approval, taxes, compliance |

See [FAQ](/help/docs/help-faq) for redirect mismatch errors.
`,
  },

  {
    slug: "generated-app-authentication",
    title: "Generated App Authentication",
    description: "How end-user login works in apps you build — separate from your Vodex builder account.",
    category: "Integrations",
    readMinutes: 5,
    keywords: ["generated app login", "Vodex login", "YOUR_SUPABASE_PROJECT"],
    content: `## Two logins

| Login | Who | Typical URL |
|-------|-----|-------------|
| **Vodex platform** | You, the builder | \`https://vodex.dev\` |
| **Your generated app** | Your app’s end users | \`https://YOUR_APP_DOMAIN\` or \`https://YOUR_CUSTOM_DOMAIN\` |

Signing into Vodex does **not** configure OAuth for an app you ship. Each generated app uses **your Supabase project** (recommended) and your chosen public URL.

## Do I need my own Supabase project?

**Yes, for production apps you publish.** Vodex generates code that expects \`NEXT_PUBLIC_SUPABASE_URL\` and keys from **your** project. You control Auth providers, RLS, and redirect URLs.

## Callback URLs summary

- **App (after Supabase redirects back):** \`https://YOUR_APP_DOMAIN/auth/callback\`
- **Supabase (provider → Supabase):** \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`
- **Platform only:** \`https://vodex.dev/auth/callback\`

Use [Google & GitHub OAuth setup](/help/docs/oauth-setup) for step-by-step provider configuration.
`,
  },

  {
    slug: "payments-providers",
    title: "Payments: Stripe, Paddle, Lemon Squeezy & PayPal",
    description: "Connect payment processors to your generated app — accounts, webhooks, and responsibilities.",
    category: "Billing",
    readMinutes: 7,
    keywords: [
      "payment provider",
      "Stripe",
      "Paddle",
      "Lemon Squeezy",
      "PayPal",
      "webhook URL",
      "RevenueCat",
    ],
    content: `## Overview

Vodex can generate checkout flows and webhook handlers in **your app**. You connect **your own** processor accounts — Vodex does not become the merchant of record for your app’s sales.

## Connect a provider

1. Create an account with Stripe, Paddle, Lemon Squeezy, or PayPal.
2. Add API keys to your generated app env vars (server-only secrets without \`NEXT_PUBLIC_\`).
3. Set webhook URL to your **app’s public domain**, e.g. \`https://YOUR_APP_DOMAIN/api/webhooks/stripe\`.
4. If you use a **custom domain**, use \`https://YOUR_CUSTOM_DOMAIN/...\` for the same paths.

## Mobile / app wrapping

For Play Store or App Store builds, see [Play Store setup](/help/docs/play-store-setup) and your provider’s mobile SDK or [RevenueCat](https://www.revenuecat.com) docs if you add subscription sync.

## Your responsibilities

Vodex provides integration tools, generated code, and connection flows. **You** are responsible for:

- Creating and maintaining processor accounts
- Provider approval and KYC
- Taxes, invoicing, and local regulations
- Disputes, chargebacks, and refunds under the processor’s terms
- Compliance with card network and platform rules

Vodex is not a payment facilitator for apps you publish.

## Troubleshooting

- **Webhook 404:** \`NEXT_PUBLIC_APP_URL\` must match the domain configured in the dashboard.
- **Signature errors:** Use the production webhook secret from the processor, not test mode.
- **OAuth vs payments:** Payment return URLs use your app domain — same rule as [custom domains](/help/docs/custom-domains).
`,
  },

  {
    slug: "help-faq",
    title: "FAQ",
    description: "Common questions about domains, OAuth, credits, publishing, payments, and mobile apps.",
    category: "FAQ",
    readMinutes: 12,
    keywords: [
      "redirect_uri_mismatch",
      "provider not enabled",
      "callback_failed",
      "Action Credits",
      "Build Credits",
      "Play Store",
      "app wrapping",
      "RevenueCat",
    ],
    content: `## Domains & OAuth

### Which domain should I use for OAuth callbacks?

Use the URL **end users open for your app**:

- Local: \`http://localhost:3000/auth/callback\`
- Published: \`https://APP_SLUG.vodex.app/auth/callback\` or \`https://YOUR_APP_DOMAIN/auth/callback\`
- Custom domain: \`https://YOUR_CUSTOM_DOMAIN/auth/callback\`

In Google/GitHub, register **Supabase’s** callback: \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`.

Only use \`https://vodex.dev/auth/callback\` when configuring **Vodex platform login**, not your generated app.

### What is the difference between Vodex login and my generated app login?

**Vodex login** is for building apps on vodex.dev. **Generated app login** is for *your* customers on *your* deployed URL, usually powered by *your* Supabase project.

### How do custom domains affect OAuth, payments, and webhooks?

Everything public-facing must switch to \`YOUR_CUSTOM_DOMAIN\`: Supabase redirect URLs, \`NEXT_PUBLIC_APP_URL\`, Stripe webhooks, and email links. See [Custom domains](/help/docs/custom-domains).

### Why does Google say redirect URI mismatch?

The URI sent to Google must exactly match what you registered — almost always \`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`. A common mistake is putting \`vodex.dev\` or your app URL in Google instead of Supabase.

### Why does Supabase say provider not enabled?

Enable Google or GitHub under **Auth → Providers** and save Client ID / Secret.

### What should I do if OAuth works locally but not after publishing?

Add your **published** and **custom** URLs to Supabase redirect URLs, set production \`NEXT_PUBLIC_APP_URL\`, and redeploy.

---

## Payments

### How do I connect Stripe / Paddle / Lemon Squeezy / PayPal to my generated app?

See [Payments setup](/help/docs/payments-providers). Use **your** processor account and webhook URLs on **your** app domain.

### Who handles approvals, disputes, taxes, and compliance?

You do, through your processor account. Vodex supplies integration code and UI patterns, not merchant-of-record services for your app.

---

## Supabase & building

### Do I need my own Supabase project for generated apps?

Yes for real deployments. You own data, Auth, and RLS in your project.

### What are Build Credits vs Action Credits?

- **Build Credits:** AI building inside Vodex (Discuss, Create, Build, edits).
- **Action Credits:** Runtime actions in live apps (AI, email, images, automations).

Details: [How credits work](/help/docs/how-credits-work).

### Why did a build use credits?

Build and Agent modes run models and pipelines that consume **Build Credits**. See your usage in **Settings → Billing**.

### Why do AI / image / email actions use Action Credits?

Those run in **deployed apps** against your plan’s Action pool, separate from building in the editor.

---

## Publishing & mobile

### How do I publish a generated app?

Use **Publish** in the app dashboard after a successful build. Vodex assigns \`APP_SLUG\` and a public URL (subdomain or \`/p/APP_SLUG\` depending on DNS settings). See [Deploying your app](/help/docs/deployment).

### How do I prepare for Play Store / App Store wrapping?

See [Play Store setup](/help/docs/play-store-setup). You need package ID, SHA256 fingerprints, and \`assetlinks.json\` on **your** domain.

### What does Vodex handle vs what I configure?

| Vodex | You |
|-----------|-----|
| AI generation, builder UI, publish flow | Supabase project, OAuth providers, DNS |
| Code for auth/checkout routes | Payment accounts, webhooks, taxes |
| Credits for platform AI | Store listings, compliance, support for your users |
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: "model-routing",
    title: "AI Model Routing",
    description: "How Vodex selects AI models, and how to customise model selection for your projects.",
    category: "AI Modes",
    readMinutes: 5,
    content: `## Auto mode

By default, Vodex uses **Auto** mode to select the best model for each task. Auto routing considers:

- **Task type** — simple edit vs. complex architecture
- **Context length** — how many tokens your request requires
- **Budget** — your remaining credits and plan tier
- **Speed requirement** — whether you need a quick response or can wait for higher quality

## Manual model selection

You can override the auto-selected model at any time using the model picker in the chat input bar.

## Orchestration modes

When creating an app from the home screen, you can choose an orchestration mode:

| Mode | Runtime | Model strategy |
|------|---------|----------------|
| **Fast** | 8–20s | Lightweight models throughout |
| **Balanced** | 25–45s | Mixes lightweight and standard |
| **Deep Build** | 50–90s | Standard + premium for architecture |
| **Production** | 80–120s | Premium models with quality verification |
| **Autonomous** | 90–180s | Agentic loop with self-review |

## Model tiers

| Tier | Models | Credit cost |
|------|--------|-------------|
| **Standard** | Claude Haiku, Gemini Flash, GPT-5.4 Mini | Low |
| **Premium** | Claude Sonnet, GPT-5.4, Gemini Pro | Medium |
| **Ultra** | Claude Opus, GPT-5.5, Grok 4 | High |

Your plan determines which tiers you can access:

- Free & Starter: Standard only
- Pro: Standard + Premium
- Studio & above: All tiers including Ultra

## Default model

You can set a default model in **Settings → Models → Default Model**. This model is used when Auto mode selects a standard-tier model, replacing it with your preference.

## Disabling models

Disable specific models to prevent them from being used, even by Auto routing. Go to **Settings → Models** and toggle the models you don't want.

## Recommended model per task

| Task | Recommended |
|------|-------------|
| Simple UI edits | Claude Haiku / Gemini Flash |
| Feature development | Claude Sonnet / GPT-5.4 |
| Full app generation | Claude Opus / GPT-5.5 |
| Large codebase analysis | Gemini Pro (2M context) |
| Code refactoring | Composer (Cursor) |
`,
  },

  {
    slug: "action-credits-overview",
    title: "What Action Credits Are Used For",
    description: "Runtime AI, email, media, and automations in your live apps.",
    category: "Billing",
    readMinutes: 4,
    keywords: ["Action Credits", "runtime", "email", "video"],
    content: `## Action Credits power live apps

**Action Credits** pay for provider work when a **deployed/generated app** runs paid actions:

- Runtime AI and chatbots
- Email notifications and contact forms
- Image and logo generation
- Draft video clips
- Automations that call external providers
- File transformations with real infrastructure cost

**Build Credits** are separate — they cover building inside Vodex (Discuss, Edit, Build).

Visitors to your published app do **not** pay Vodex directly. **You** (the app owner) spend Action Credits when your app triggers paid provider work.

See also: [How credits work](/help/docs/how-credits-work).`,
  },

  {
    slug: "generated-app-runtime-billing",
    title: "Generated App Owner Runtime Billing",
    description: "How Vodex meters Action Credits for live app features.",
    category: "Billing",
    readMinutes: 4,
    keywords: ["runtime billing", "app owner", "visitor"],
    content: `## Who pays?

When someone uses your published app and triggers AI, email, or media, **your** Vodex Action Credit balance is charged — not the visitor's.

Normal app features keep working without Action Credits:

- Database reads/writes you configured
- Page navigation and forms
- Local validation and config reads

Paid provider actions pause if you run out of Action Credits. Visitors see a friendly message; you see warnings in the dashboard.`,
  },

  {
    slug: "action-credits-depleted",
    title: "What Happens When Action Credits Run Out",
    description: "Provider actions pause; your app pages and database keep working.",
    category: "Billing",
    readMinutes: 3,
    keywords: ["out of credits", "depleted", "unavailable"],
    content: `## At 100% usage

- Runtime AI, email, images, video, and similar **provider** actions are **blocked before they start**
- Visitors see: *This AI feature is temporarily unavailable. Please try again later.*
- You receive dashboard (and email, when possible) warnings

## What still works

- App pages and navigation
- Database CRUD you set up
- Forms that only save data (no paid email/AI)

Credits restore on your **monthly plan reset** or when you purchase a top-up.`,
  },

  {
    slug: "video-action-credits",
    title: "Why Video Costs More Action Credits",
    description: "Draft video uses many Action Credits because provider costs are much higher than email or small AI calls.",
    category: "Billing",
    readMinutes: 3,
    keywords: ["video", "draft video", "Action Credits"],
    content: `## Draft video only by default

Vodex routes published apps to **cheap draft video** providers — not premium cinematic models.

A typical **5-second draft clip** uses roughly **55–60 Action Credits** because underlying video generation costs far more than a single email or small AI reply.

Longer clips scale proportionally. If a provider quotes higher than expected, Vodex asks for confirmation before running.

**Free** plans cannot use video. **Starter** may use limited draft video when you have enough Action Credits.`,
  },

  {
    slug: "email-action-credits",
    title: "Email Notifications and Action Credits",
    description: "Contact forms and notification emails consume Action Credits on the app owner account.",
    category: "Billing",
    readMinutes: 3,
    keywords: ["email", "contact form", "Resend"],
    content: `## Metered emails

When your live app sends:

- Contact form notifications to you
- Transactional or notification emails through Vodex routing

…the **app owner's** Action Credits are charged **before** the email is sent.

If you lack credits, the form can still save the submission, but the notification email will not send until credits are available again.

Bulk or per-recipient automations charge **per recipient** — no partial sends.`,
  },

  {
    slug: "image-logo-action-credits",
    title: "Image & Logo Generation and Action Credits",
    description: "Vodex Logo and image tiers use Action Credits with pre-checks before generation.",
    category: "Billing",
    readMinutes: 3,
    keywords: ["logo", "image", "Vodex Logo"],
    content: `## User-facing labels

You see simple names like **Vodex Logo**, **Vodex Image Small**, and **Vodex Image Medium** — not raw provider model names.

Logos generated during a real **build** consume Action Credits. Casual Discuss questions do not auto-generate logos.

Regenerating a logo from the dashboard checks your balance **before** generation starts.

Premium ultra-HD or experimental image modes are not enabled by default.`,
  },

  {
    slug: "reduce-runtime-costs",
    title: "How to Reduce Runtime Costs",
    description: "Practical tips to stretch Action Credits on live apps.",
    category: "Billing",
    readMinutes: 4,
    keywords: ["save credits", "reduce cost", "runtime"],
    content: `## Tips

1. Use Discuss/planning in the builder (Build Credits) before enabling heavy runtime AI in production.
2. Prefer simple notification emails over bulk sequences during early launches.
3. Use draft video sparingly — clips are the largest Action Credit use.
4. Cache static responses where your app allows it.
5. Upgrade plan or top up before marketing spikes that drive contact forms and AI chat.`,
  },

  {
    slug: "vodex-paddle-billing",
    title: "Vodex Billing with Paddle",
    description: "Vodex subscriptions are billed through Paddle as Merchant of Record.",
    category: "Billing",
    readMinutes: 3,
    keywords: ["Paddle", "subscription", "Vodex billing"],
    content: `## Platform subscriptions

Vodex **plan** subscriptions (Free, Starter, Pro, Infinity) are processed by **Paddle**.

Paddle handles checkout, tax, and subscription management for your **Vodex account**.

### Upgrades (no proration)

- You pay the **full new plan price** when you upgrade — not a prorated “remaining days” charge.
- Your billing cycle **restarts** and monthly Build + Action Credits **refresh** to the new plan allowance.
- Unused monthly allowance from the old plan does **not** stack on top of the new plan.
- Credits update only after Paddle confirms payment (webhook).

### Downgrades

- Downgrades apply at your **next renewal**. Your current plan stays active until then.

This is separate from payment processors you connect to **your generated apps** for your own customers.`,
  },

  {
    slug: "app-payments-vs-vodex-billing",
    title: "Generated App Payment Processors vs Vodex Billing",
    description: "Your app checkout is yours; Vodex plans use Paddle.",
    category: "Billing",
    readMinutes: 4,
    keywords: ["Stripe", "Paddle", "Lemon Squeezy", "generated app"],
    content: `## Two billing layers

| | Vodex plans | Your generated app |
|---|---|---|
| **Processor** | Paddle (Vodex) | Stripe, Paddle, Lemon Squeezy, PayPal, RevenueCat, etc. |
| **Who pays** | You, for builder + Action Credits | Your end customers |
| **Compliance** | Vodex + Paddle | **You** and your processor |

Vodex is **not** responsible for your app's chargebacks, taxes, disputes, refunds, or KYC — only for integration patterns and UI.

See [Payments setup](/help/docs/payments-providers) for connecting processors to apps.`,
  },

  {
    slug: "policies",
    title: "Policies & Legal",
    description:
      "One place for Vodex terms, privacy, refunds, billing rules, and acceptable use.",
    category: "Policies",
    readMinutes: 4,
    keywords: ["terms", "privacy", "refund", "legal", "policy", "billing policy"],
    content: `## Overview

Vodex policies explain how the platform works, what we are responsible for, and what you agree to when you use the product. Use this page as your index — each policy has a full version on its own page.

---

## Platform legal documents

| Document | Summary | Full policy |
|----------|---------|-------------|
| **Terms of Service** | Account rules, acceptable use, liability, and service boundaries | [Read Terms](/terms) |
| **Privacy Policy** | How we collect, use, and protect your data | [Read Privacy](/privacy) |
| **Refund Policy** | Subscription refunds, credits, and generated-app payments | [Read Refunds](/refunds) |

---

## Billing & credits policies

These rules are also summarized on [Pricing](/pricing) and in [How credits work](/help/docs/how-credits-work).

| Topic | Policy |
|-------|--------|
| **Plan upgrades** | Full new plan price today — **no prorated upgrade charges**. Billing cycle restarts; monthly Build and Action Credits refresh to the new allowance. |
| **Plan downgrades** | Apply at **next renewal**; current plan stays active until then. |
| **Monthly credits** | Reset each billing cycle; unused monthly allowance does not roll over. |
| **Credit packs** | Purchased top-ups are separate from plan allowance and may persist separately. |
| **Vodex billing** | Platform subscriptions use **Paddle** as Merchant of Record. See [Vodex Billing with Paddle](/help/docs/vodex-paddle-billing). |

---

## Generated app payments

Payment processors you connect to **apps you build** (Stripe, Paddle, PayPal, etc.) are governed by **your** agreements with those providers and your own policies — not Vodex's subscription terms.

See [Generated app payments vs Vodex billing](/help/docs/app-payments-vs-vodex-billing).

---

## Questions

Contact [support@vodex.dev](mailto:support@vodex.dev) if you need clarification on any policy.`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDoc(slug: string): DocArticle | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function getDocsByCategory(): Record<string, DocArticle[]> {
  const map: Record<string, DocArticle[]> = {};
  for (const doc of DOCS) {
    if (!map[doc.category]) map[doc.category] = [];
    map[doc.category].push(doc);
  }
  return map;
}
