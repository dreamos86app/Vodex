import type { HelpArticle } from "@/lib/help/cms/types";

export const AI_PROVIDER_ARTICLES: HelpArticle[] = [
  {
    slug: "openai",
    categorySlug: "ai-providers",
    title: "OpenAI in Your App",
    description: "API keys, billing limits, and runtime vs Vodex build credits.",
    category: "AI Providers",
    readMinutes: 7,
    difficulty: "beginner",
    relatedSlugs: ["integrations/openai"],
    lastUpdated: "2026-05-19",
    content: `## Two different uses of AI

| Context | Billing |
|---------|---------|
| **Building in Vodex** | Vodex build + action credits |
| **Your published app** | Your OpenAI account |

## Setup

See [OpenAI integration guide](/help/integrations/openai).

## Cost control

Set monthly budget caps in OpenAI dashboard. Use cheaper models for high-volume features.
`,
  },
  {
    slug: "anthropic",
    categorySlug: "ai-providers",
    title: "Anthropic in Your App",
    description: "Claude API for production features.",
    category: "AI Providers",
    readMinutes: 6,
    difficulty: "beginner",
    relatedSlugs: ["integrations/anthropic"],
    lastUpdated: "2026-05-19",
    content: `See [Anthropic integration](/help/integrations/anthropic) for setup steps.`,
  },
  {
    slug: "gemini",
    categorySlug: "ai-providers",
    title: "Gemini in Your App",
    description: "Google AI models in production.",
    category: "AI Providers",
    readMinutes: 6,
    difficulty: "beginner",
    relatedSlugs: ["integrations/gemini"],
    lastUpdated: "2026-05-19",
    content: `See [Gemini integration](/help/integrations/gemini) for setup steps.`,
  },
];
