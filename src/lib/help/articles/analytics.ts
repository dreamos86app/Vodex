import type { HelpArticle } from "@/lib/help/cms/types";

export const ANALYTICS_ARTICLES: HelpArticle[] = [
  {
    slug: "insights-dashboard",
    categorySlug: "analytics",
    title: "Insights & Analytics",
    description: "Users, growth, revenue, and auth events for published apps.",
    category: "Analytics",
    readMinutes: 8,
    difficulty: "beginner",
    relatedSlugs: ["payments/stripe"],
    lastUpdated: "2026-05-19",
    content: `## Dashboard sections

| Section | What it shows |
|---------|----------------|
| **Insights** | Page views, auth events, payment events |
| **Users** | \`app_user_profiles\` from real sign-ins |
| **Growth** | Signups over time |
| **Data** | Tables overview |

## Auth events

\`login_success\`, \`signup_success\`, \`auth_error\` — from published auth runtime.

## Revenue events

Require payment webhooks configured. No fake MRR — empty until real events arrive.

## Refresh

Users panel refreshes on window focus after new signups.
`,
  },
];
