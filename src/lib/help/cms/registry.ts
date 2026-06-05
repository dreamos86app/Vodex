import type { HelpArticle } from "@/lib/help/cms/types";
import { INTEGRATION_ARTICLES } from "@/lib/help/articles/integrations";
import { PAYMENT_ARTICLES } from "@/lib/help/articles/payments";
import { MOBILE_ARTICLES } from "@/lib/help/articles/mobile-apps";
import { AUTHENTICATION_ARTICLES } from "@/lib/help/articles/authentication";
import { DOMAINS_ARTICLES } from "@/lib/help/articles/domains";
import { GETTING_STARTED_ARTICLES } from "@/lib/help/articles/getting-started";
import { PUBLISHING_ARTICLES } from "@/lib/help/articles/publishing";
import { ANALYTICS_ARTICLES } from "@/lib/help/articles/analytics";
import { TROUBLESHOOTING_ARTICLES } from "@/lib/help/articles/troubleshooting";
import { AI_PROVIDER_ARTICLES } from "@/lib/help/articles/ai-providers";
import { helpArticlePath } from "@/lib/help/cms/paths";

export const HELP_ARTICLES: HelpArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...PUBLISHING_ARTICLES,
  ...AUTHENTICATION_ARTICLES,
  ...INTEGRATION_ARTICLES,
  ...PAYMENT_ARTICLES,
  ...MOBILE_ARTICLES,
  ...ANALYTICS_ARTICLES,
  ...DOMAINS_ARTICLES,
  ...AI_PROVIDER_ARTICLES,
  ...TROUBLESHOOTING_ARTICLES,
];

export function getHelpArticle(categorySlug: string, slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.categorySlug === categorySlug && a.slug === slug);
}

export function getHelpArticleByLegacySlug(legacySlug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.legacySlug === legacySlug || a.slug === legacySlug);
}

export function getArticlesByCategorySlug(categorySlug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categorySlug === categorySlug);
}

export function getRelatedArticles(article: HelpArticle, limit = 4): HelpArticle[] {
  const related: HelpArticle[] = [];
  for (const ref of article.relatedSlugs ?? []) {
    const [cat, slug] = ref.includes("/") ? ref.split("/") : [article.categorySlug, ref];
    const found = getHelpArticle(cat!, slug!);
    if (found) related.push(found);
  }
  const sameCat = HELP_ARTICLES.filter(
    (a) => a.categorySlug === article.categorySlug && a.slug !== article.slug,
  );
  for (const a of sameCat) {
    if (related.length >= limit) break;
    if (!related.some((r) => r.slug === a.slug)) related.push(a);
  }
  return related.slice(0, limit);
}

export function getAllHelpArticleLinks(): Array<{ title: string; href: string; category: string }> {
  return HELP_ARTICLES.map((a) => ({
    title: a.title,
    href: helpArticlePath(a),
    category: a.category,
  }));
}

/** Required P4.8 integration guide slugs */
export const REQUIRED_INTEGRATION_GUIDES = [
  "github",
  "supabase",
  "stripe",
  "paypal",
  "paddle",
  "lemon-squeezy",
  "revenuecat",
  "resend",
  "openai",
  "anthropic",
  "gemini",
  "firebase",
] as const;

export const REQUIRED_PAYMENT_GUIDES = [
  "stripe",
  "paypal",
  "paddle",
  "lemon-squeezy",
  "revenuecat",
] as const;
