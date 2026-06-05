import type { HelpArticle } from "@/lib/help/cms/types";

export const TROUBLESHOOTING_ARTICLES: HelpArticle[] = [
  {
    slug: "common-errors",
    categorySlug: "troubleshooting",
    legacySlug: "help-faq",
    title: "Common Errors",
    description: "OAuth, integrations, payments, and publish issues.",
    category: "Troubleshooting",
    readMinutes: 12,
    difficulty: "beginner",
    lastUpdated: "2026-05-19",
    content: `## Auth

**redirect_uri_mismatch** — Add central callback to Supabase redirect URLs.

**exchange_failed** — Test in incognito; check auth diagnostics.

## Integrations

**Missing required fields** — Open integration guide, complete checklist.

**Invalid credentials** — Regenerate API key at provider.

## Payments

**Webhook not verified** — Save webhook secret; send test event.

**Plan required** — Upgrade Vodex plan to connect live payment providers.

## Publish

**Blank published app** — Republish; check artifact in publish panel.

## Still stuck?

Contact support@vodex.dev with project ID and screenshot of diagnostics.
`,
  },
  {
    slug: "blank-published-app",
    categorySlug: "troubleshooting",
    title: "Blank Published App",
    description: "Recovery steps when live URL shows empty page.",
    category: "Troubleshooting",
    readMinutes: 6,
    difficulty: "beginner",
    lastUpdated: "2026-05-19",
    content: `## Quick fixes

1. **Republish** from Dashboard → Publish.
2. Confirm status shows **Published** with green verify.
3. Open browser devtools → check console for JS errors.
4. Try path URL vs subdomain URL.

## If import/ZIP app

Ensure entry file exists in artifact. Run repair from dashboard if offered.

## Contact support

Include slug, URL, and time of last successful publish.
`,
  },
];
