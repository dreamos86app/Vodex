import type { HelpArticle } from "@/lib/help/cms/types";

export const AUTHENTICATION_ARTICLES: HelpArticle[] = [
  {
    slug: "overview",
    categorySlug: "authentication",
    legacySlug: "generated-app-authentication",
    title: "Published App Authentication",
    description: "How sign-in works for apps you publish on Vodex.",
    category: "Authentication",
    readMinutes: 10,
    difficulty: "beginner",
    relatedSlugs: ["authentication/google-login", "authentication/oauth-redirect-urls"],
    lastUpdated: "2026-05-19",
    content: `## Overview

Published apps get login, signup, and password reset pages at:

\`/p/your-slug/login\` (or your custom domain / subdomain).

## Sign-in methods

| Method | Vodex-managed | Custom OAuth (Pro+) |
|--------|---------------|---------------------|
| Google | ✓ | Your Google app credentials |
| GitHub | ✓ | Your GitHub OAuth app |
| Email/password | ✓ | Platform Supabase |
| Apple | ✓ (managed) | Gated for custom |

## Vodex-managed OAuth (recommended)

Vodex operates platform Supabase Auth. You enable providers in **Dashboard → Settings → Authentication**.

## Custom OAuth

Pro+ users store encrypted Google/GitHub client secrets. Must mirror credentials in Supabase Auth providers.

## Security best practices

- Use central callback URL (one URL for all apps).
- Never expose service role keys in client bundles.
- Enable only providers you need.
- Review **Auth diagnostics** after each publish.

## User sync

Successful logins create \`app_user_profiles\` rows visible in **Users** dashboard.
`,
  },
  {
    slug: "google-login",
    categorySlug: "authentication",
    title: "Google Login Setup",
    description: "Enable Google sign-in for your published app.",
    category: "Authentication",
    readMinutes: 12,
    difficulty: "intermediate",
    relatedSlugs: ["authentication/oauth-redirect-urls"],
    lastUpdated: "2026-05-19",
    content: `## Step 1: Enable Google in Vodex

**Dashboard → Settings → Authentication** → enable **Google**.

## Step 2: Configure Supabase

Supabase Dashboard → **Authentication → Providers → Google** → enable.

## Step 3: Redirect URLs (critical)

Add **one** central callback to Supabase redirect URLs:

\`https://vodex.dev/auth/callback\`

(Or \`https://auth.vodex.dev/auth/callback\` if using auth subdomain.)

In **Google Cloud Console**, authorized redirect URI is always:

\`https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback\`

**Not** your app domain.

## Step 4: Test

1. Open incognito window.
2. Visit \`/p/your-slug/login\`.
3. Sign in with Google.
4. Confirm redirect back to app.
5. Check **Users** dashboard and **Insights** for login event.

## Common errors

| Error | Fix |
|-------|-----|
| redirect_uri_mismatch | Add exact callback URLs |
| access_denied | User cancelled — normal |
| exchange_failed | PKCE cookie / central callback misconfig |
`,
  },
  {
    slug: "oauth-redirect-urls",
    categorySlug: "authentication",
    legacySlug: "oauth-setup",
    title: "OAuth & Redirect URLs",
    description: "Central callback architecture — one URL for thousands of apps.",
    category: "Authentication",
    readMinutes: 8,
    difficulty: "intermediate",
    lastUpdated: "2026-05-19",
    content: `## Central callback (P4.7+)

**Recommended:** \`https://vodex.dev/auth/callback\`

Configure once in Supabase and Google. All published apps use signed state to return users to the correct app URL.

## Legacy per-app callback

\`https://vodex.dev/p/slug/auth/callback\` — still works as fallback but does not scale.

## Email/password

Uses same Supabase project. Confirmation links use published callback URL.

## Custom domains

Return URL stored in signed OAuth state — must be relative path on your domain.

## Diagnostics

**Settings → Authentication → Auth diagnostics** shows required URLs and last error.
`,
  },
];
