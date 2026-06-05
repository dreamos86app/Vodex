import type { HelpArticle } from "@/lib/help/cms/types";

export const DOMAINS_ARTICLES: HelpArticle[] = [
  {
    slug: "custom-domains",
    categorySlug: "domains",
    legacySlug: "custom-domains",
    title: "Custom Domains & DNS",
    description: "CNAME, TXT verification, SSL, and provider-specific guides.",
    category: "Domains",
    readMinutes: 15,
    difficulty: "intermediate",
    relatedSlugs: ["publishing/first-publish"],
    lastUpdated: "2026-05-19",
    content: `## What is DNS?

DNS maps your domain (e.g. \`app.yourbrand.com\`) to Vodex servers. You add records at your registrar or DNS host.

## CNAME

Points a hostname to Vodex:

\`www\` or \`app\` → CNAME → \`your-slug.vodex.app\` (exact value shown in Vodex Domains panel).

## TXT verification

Proves you own the domain. Add TXT record Vodex provides, then click **Verify**.

## SSL

Vodex provisions HTTPS automatically after DNS verifies. Allow up to 24h for certificate issuance.

## Propagation

DNS changes can take 5 minutes to 48 hours. Use [dnschecker.org](https://dnschecker.org) to confirm.

## Cloudflare

1. Add CNAME (orange cloud **DNS only** / grey cloud recommended initially).
2. Disable "Always use HTTPS" redirect loops during setup.
3. SSL mode: **Full** after origin works.

## GoDaddy

DNS Management → Add CNAME + TXT. TTL 600s or default.

## Namecheap

Advanced DNS → add records. Remove conflicting A records on same host.

## IONOS

Domains → DNS → add CNAME/TXT per Vodex instructions.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| CNAME on apex (@) | Use subdomain \`app\` or ALIAS if registrar supports |
| Wrong target | Copy exact CNAME from Vodex |
| Proxy + wrong SSL | Grey-cloud in Cloudflare during setup |
| Old A record conflicts | Remove stale A on same hostname |

## After verification

Republish app. Test \`https://your-domain.com\` and auth callback on custom domain.
`,
  },
];
