import type { HelpArticle } from "@/lib/help/cms/types";

export const GETTING_STARTED_ARTICLES: HelpArticle[] = [
  {
    slug: "quick-start",
    categorySlug: "getting-started",
    legacySlug: "getting-started",
    title: "Quick Start",
    description: "Create, customize, and publish your first Vodex app.",
    category: "Getting Started",
    readMinutes: 5,
    difficulty: "beginner",
    relatedSlugs: ["publishing/first-publish", "integrations/supabase"],
    lastUpdated: "2026-05-19",
    content: `## What is Vodex?

Describe your app in plain language. Vodex generates code, database, auth, and deployment config.

## Create your first app

1. Go to **Create**.
2. Describe your app (audience, features, design).
3. Press **Create** — workspace opens.

## Workspace tour

- **Chat** — change your app with AI
- **Dashboard** — integrations, publish, users, payments
- **Preview** — see live UI

## Recommended first-hour path

1. [Publish your app](/help/publishing/first-publish)
2. [Connect Supabase](/help/integrations/supabase) (if you need a database)
3. [Enable Google login](/help/authentication/google-login)
4. Share your live URL

## Need help?

Use **Learn** buttons on any dashboard section or browse the [Help Center](/help).
`,
  },
];
