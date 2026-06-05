import type { HelpArticle } from "@/lib/help/cms/types";

export const PUBLISHING_ARTICLES: HelpArticle[] = [
  {
    slug: "first-publish",
    categorySlug: "publishing",
    legacySlug: "deployment",
    title: "Publish Your First App",
    description: "Go live on vodex.dev, subdomains, and custom domains.",
    category: "Publishing Apps",
    readMinutes: 10,
    difficulty: "beginner",
    relatedSlugs: ["domains/custom-domains", "authentication/google-login"],
    lastUpdated: "2026-05-19",
    content: `## Before you publish

- [ ] App builds without errors
- [ ] Secrets configured (if using database/APIs)
- [ ] Auth providers enabled (if users sign in)

## Publish steps

1. **Dashboard → Publish**.
2. Choose slug (e.g. \`my-app\` → \`vodex.dev/p/my-app\`).
3. Run readiness checklist — fix blockers.
4. Click **Publish**.
5. Open live URL in incognito to verify.

## URLs after publish

| Type | Example |
|------|---------|
| Path | \`https://vodex.dev/p/my-app\` |
| Subdomain | \`https://my-app.vodex.app\` (when enabled) |
| Custom | \`https://app.yourbrand.com\` |

## Updates

Republish after major changes. Auth and integrations persist across republishes.

## Troubleshooting blank page

See [Troubleshooting](/help/troubleshooting/blank-published-app).
`,
  },
];
