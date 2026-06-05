import type { HelpArticle } from "@/lib/help/cms/types";

export function helpArticlePath(article: Pick<HelpArticle, "categorySlug" | "slug">): string {
  return `/help/${article.categorySlug}/${article.slug}`;
}

export function helpCategoryPath(categorySlug: string): string {
  return `/help/${categorySlug}`;
}
